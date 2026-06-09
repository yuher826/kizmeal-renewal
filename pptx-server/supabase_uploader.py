# -*- coding: utf-8 -*-
"""
Supabase Storage 업로더
========================================================================

환경변수:
  SUPABASE_URL         — Supabase 프로젝트 URL
  SUPABASE_SERVICE_KEY — service_role 키

업로드 경로:
  week_num 있음:  {year}/{month:02d}/week{week_num}/{파일명}
  week_num 없음:  {year}/{month:02d}/{파일명}

⚠️ 일본어 금지.
"""

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

from dotenv import load_dotenv

load_dotenv()

_BUCKET = 'diet-files'
_client = None

_MIME = {
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf':  'application/pdf',
}


# ════════════════════════════════════════════════════════════════════
# REST 클라이언트
# ════════════════════════════════════════════════════════════════════
class SupabaseREST:
    """urllib.request 기반 Supabase REST/Storage 클라이언트."""

    def __init__(self, url, key):
        self._url = url.rstrip('/')
        self._key = key

    def _auth_headers(self):
        return {
            'apikey': self._key,
            'Authorization': f'Bearer {self._key}',
        }

    def _call(self, method, url, data=None, extra_headers=None):
        headers = {**self._auth_headers()}
        if extra_headers:
            headers.update(extra_headers)
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                return json.loads(raw.decode()) if raw else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors='replace')
            raise RuntimeError(f'HTTP {exc.code} {exc.reason}: {detail}') from exc

    def select(self, table, columns='*', filters=None):
        """SELECT — filters: {col: value} (value=None → IS NULL)"""
        params = urllib.parse.urlencode({'select': columns})
        for col, val in (filters or {}).items():
            if val is None:
                params += f'&{col}=is.null'
            else:
                params += f'&{col}=eq.{urllib.parse.quote(str(val), safe="")}'
        url = f'{self._url}/rest/v1/{table}?{params}'
        return self._call('GET', url, extra_headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }) or []

    def upsert(self, table, data, on_conflict=None):
        """INSERT … ON CONFLICT DO UPDATE"""
        url = f'{self._url}/rest/v1/{table}'
        if on_conflict:
            url += f'?on_conflict={urllib.parse.quote(on_conflict, safe="")}'
        self._call('POST', url, data=data, extra_headers={
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
        })

    def update(self, table, data, filters):
        """PATCH 행 업데이트 — filters: {col: value}"""
        params = '&'.join(
            f'{col}=eq.{urllib.parse.quote(str(val), safe="")}'
            for col, val in filters.items()
        )
        url = f'{self._url}/rest/v1/{table}?{params}'
        self._call('PATCH', url, data=data, extra_headers={
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        })

    def insert(self, table, data):
        """단순 INSERT"""
        url = f'{self._url}/rest/v1/{table}'
        self._call('POST', url, data=data, extra_headers={
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        })

    def upload_file(self, bucket, path, data, mime):
        """Storage 파일 업로드 (upsert)"""
        url = f'{self._url}/storage/v1/object/{bucket}/{path}'
        req = urllib.request.Request(url, data=data, headers={
            **self._auth_headers(),
            'Content-Type': mime,
            'x-upsert': 'true',
        }, method='POST')
        try:
            with urllib.request.urlopen(req):
                pass
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors='replace')
            raise RuntimeError(f'Storage upload HTTP {exc.code}: {detail}') from exc

    def get_public_url(self, bucket, path):
        return f'{self._url}/storage/v1/object/public/{bucket}/{path}'


# ════════════════════════════════════════════════════════════════════
# 클라이언트 싱글턴
# ════════════════════════════════════════════════════════════════════
def get_supabase_client():
    global _client
    if _client is None:
        url = os.getenv('SUPABASE_URL', '')
        key = os.getenv('SUPABASE_SERVICE_KEY', '')
        if not url or not key:
            raise ValueError('SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수가 필요합니다.')
        _client = SupabaseREST(url, key)
    return _client


# ════════════════════════════════════════════════════════════════════
# public URL 조회
# ════════════════════════════════════════════════════════════════════
def get_public_url(path):
    """Storage 버킷 내 path의 public URL 반환."""
    client = get_supabase_client()
    return client.get_public_url(_BUCKET, path)


# ════════════════════════════════════════════════════════════════════
# 단일 파일 업로드 (1회 재시도)
# ════════════════════════════════════════════════════════════════════
def _upload_one(client, local_path, storage_path):
    """
    파일 1개를 Storage에 업로드.
    실패 시 1회 재시도. upsert=True 로 덮어쓰기 허용.
    반환: public URL 문자열 (실패 시 '')
    """
    ext  = os.path.splitext(local_path)[1].lower()
    mime = _MIME.get(ext, 'application/octet-stream')

    with open(local_path, 'rb') as f:
        data = f.read()

    for attempt in range(2):
        try:
            client.upload_file(_BUCKET, storage_path, data, mime)
            return client.get_public_url(_BUCKET, storage_path)
        except Exception as exc:
            if attempt == 0:
                print(f'  [업로드 재시도] {storage_path}: {exc}')
            else:
                print(f'  [업로드 실패] {storage_path}: {exc}')
                return ''
    return ''


# ════════════════════════════════════════════════════════════════════
# 디렉토리 일괄 업로드
# ════════════════════════════════════════════════════════════════════
def upload_all(output_dir, year, month, week_num):
    """
    output_dir 내 .pptx / .pdf 파일 전부 업로드.

    반환:
      {branch_name: {"pptx_url": "...", "pdf_url": "..."}}
    """
    if week_num is not None:
        prefix = f'{year}/{month:02d}/week{week_num}'
    else:
        prefix = f'{year}/{month:02d}'

    try:
        client = get_supabase_client()
    except ValueError as exc:
        print(f'[Supabase 미설정] {exc} → Storage 업로드 건너뜀')
        return {}

    result = {}

    for fname in sorted(os.listdir(output_dir)):
        ext = os.path.splitext(fname)[1].lower()
        if ext not in ('.pptx', '.pdf'):
            continue

        local_path = os.path.join(output_dir, fname)

        # 파일명에서 branch_name 추출: "{name}_{YYYYMM}.pptx" → "{name}"
        stem = os.path.splitext(fname)[0]
        branch_name = re.sub(r'_\d{6}$', '', stem)
        if not branch_name:
            branch_name = stem

        if branch_name not in result:
            result[branch_name] = {'pptx_url': '', 'pdf_url': ''}

        storage_path = f'{prefix}/{fname}'
        url = _upload_one(client, local_path, storage_path)

        if ext == '.pptx':
            result[branch_name]['pptx_url'] = url
        elif ext == '.pdf':
            result[branch_name]['pdf_url'] = url

    return result
