# -*- coding: utf-8 -*-
"""
Supabase 연결 테스트 — stdlib 만 사용 (별도 pip 설치 불필요)
실행: python test_connection.py
"""

import os, sys, json, base64
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# ── .env.local 파싱 ───────────────────────────────────────────────────────
def load_env_local():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

load_env_local()

# ── 환경변수 읽기 ─────────────────────────────────────────────────────────
url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

print("=" * 60)
print("Supabase 연결 테스트")
print("=" * 60)
print(f"URL : {url or '❌ 없음'}")
print(f"KEY : {(key[:24] + '...') if key else '❌ 없음'}")

# JWT role 확인
if key and key.count(".") == 2:
    try:
        payload = json.loads(base64.b64decode(key.split(".")[1] + "=="))
        role = payload.get("role", "?")
        print(f"JWT role = {role}{'  ✅' if role == 'service_role' else '  ⚠️ service_role 이어야 함'}")
    except Exception:
        print("JWT role = 파싱 실패")
else:
    print("KEY 형식이 JWT(xxx.yyy.zzz)가 아님")

print()

if not url or not key:
    print("❌ 환경변수 누락 — .env.local 또는 Render 대시보드 확인 필요")
    sys.exit(1)

# ── REST API 로 branch_profiles SELECT 1개 ─────────────────────────────
endpoint = f"{url.rstrip('/')}/rest/v1/branch_profiles?select=id,branch_full_name,display_name,short_code&limit=1"
req = Request(
    endpoint,
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    },
)

try:
    with urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    if data:
        print(f"✅ 성공 — branch_profiles 첫 번째 행:")
        print(f"   {data[0]}")
    else:
        print("✅ 성공 — branch_profiles 행 없음 (테이블은 접근 가능)")
except HTTPError as e:
    body = e.read().decode(errors="replace")
    print(f"❌ HTTP {e.code}: {body}")
    print()
    if e.code == 401:
        print("→ KEY가 잘못됐거나 만료됨. Supabase > Settings > API > service_role 키 재확인")
    elif e.code == 403:
        print("→ RLS 차단. service_role 키인지 확인 (anon 키는 차단됨)")
    elif e.code == 404:
        print("→ URL이 틀렸거나 branch_profiles 테이블이 없음")
    sys.exit(1)
except URLError as e:
    print(f"❌ 연결 실패: {e.reason}")
    print("→ SUPABASE_URL 값 확인")
    sys.exit(1)
