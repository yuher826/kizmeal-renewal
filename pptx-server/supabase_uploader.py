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

import os
import re

from dotenv import load_dotenv

load_dotenv()

_BUCKET = 'diet-files'
_client = None

_MIME = {
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf':  'application/pdf',
}


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
        from supabase import create_client
        _client = create_client(url, key)
    return _client


# ════════════════════════════════════════════════════════════════════
# public URL 조회
# ════════════════════════════════════════════════════════════════════
def get_public_url(path):
    """Storage 버킷 내 path의 public URL 반환."""
    client = get_supabase_client()
    return client.storage.from_(_BUCKET).get_public_url(path)


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
            client.storage.from_(_BUCKET).upload(
                storage_path,
                data,
                file_options={
                    'content-type': mime,
                    'upsert':       'true',
                },
            )
            return get_public_url(storage_path)
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
