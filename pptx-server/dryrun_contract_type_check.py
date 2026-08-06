# -*- coding: utf-8 -*-
"""
dryrun_contract_type_check.py — contract_type 필터 검증 (읽기 전용 / dry-run)

★ 이 스크립트는 순수 조회 + 출력만 한다.
  생성·업로드·배포·Storage·GitHub Actions·DB 쓰기(insert/update/upsert)는 일절 없다.

하는 일:
  1) branch_profiles 를 contract_type 포함해 조회만 함
     (기존 프로덕션과 동일하게 filters={'contract_status': 'active'} 만 적용,
      contract_type 은 절대 DB 필터로 넣지 않음 — NULL 전멸 방지)
  2) contract_type 실제 값 분포 출력 (NULL / 빈문자열 / permanent / temporary / 기타)
  3) branch_filters.filter_eligible_branches() 로 코드 레벨 필터 → 통과 N / 제외 M,
     제외된 short_code 목록 출력
  4) 예상값(50 통과 / 1 제외)과 대조해 PASS/FAIL 명시
     (참고: 크레오 3원은 branch_profiles 행 자체가 없어 여기 안 잡히는 게 정상.
            53이 아니라 50이 나오는 게 맞음.)
"""

import os
import sys

# Windows 콘솔(cp949)에서도 한글/기호 출력이 깨지거나 크래시하지 않도록 UTF-8 강제
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from supabase_uploader import SupabaseREST          # noqa: E402
from branch_filters import (                         # noqa: E402
    is_eligible_for_pptx,
    filter_eligible_branches,
    EXCLUDED_CONTRACT_TYPE,
)

# ── 예상값 (억지로 맞추지 말 것 — 데이터 실제값 기준 대조용) ──────────────
EXPECTED_ELIGIBLE = 49   # 통과 예상 (NULL 49건)
EXPECTED_EXCLUDED = 1    # 제외 예상 (temporary 1건)


def _load_env_local():
    """
    프로젝트 루트의 .env.local 을 의존성 없이 직접 파싱해 os.environ 에 주입.
    (python-dotenv 미설치 환경 대응. 이미 설정된 값은 덮어쓰지 않음.)
    """
    env_path = os.path.join(_HERE, '..', '.env.local')
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


def _resolve_credentials():
    """
    URL/KEY 를 양쪽 네이밍에서 해석한다.
      URL : SUPABASE_URL  또는  NEXT_PUBLIC_SUPABASE_URL
      KEY : SUPABASE_SERVICE_KEY  또는  SUPABASE_SERVICE_ROLE_KEY
    """
    url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL') or ''
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY') or ''
    return url, key


def _classify(contract_type):
    """분포 집계용 라벨."""
    if contract_type is None:
        return 'NULL'
    if isinstance(contract_type, str) and contract_type.strip() == '':
        return '빈문자열'
    return str(contract_type)


def main():
    _load_env_local()
    url, key = _resolve_credentials()
    if not url or not key:
        print('ERROR: Supabase 자격증명을 찾지 못했습니다.')
        print('  필요: (SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL)')
        print('        (SUPABASE_SERVICE_KEY 또는 SUPABASE_SERVICE_ROLE_KEY)')
        sys.exit(2)

    client = SupabaseREST(url, key)

    # ── 1) 조회 (읽기 전용). contract_type 은 DB 필터에 절대 넣지 않는다. ──
    print('=' * 64)
    print('[1] branch_profiles 조회 (읽기 전용)')
    print("    DB 필터: contract_status = 'active'  (프로덕션과 동일)")
    print('    ※ contract_type 은 코드 레벨에서만 필터 — DB 필터 미사용')
    print('=' * 64)
    profiles = client.select(
        'branch_profiles',
        'id,short_code,display_name,contract_status,contract_type',
        filters={'contract_status': 'active'},
    )
    total = len(profiles)
    print(f'  조회된 활성 원(active): {total}개\n')

    # ── 2) contract_type 값 분포 (실제값 그대로) ──────────────────────
    print('=' * 64)
    print('[2] contract_type 실제 값 분포')
    print('=' * 64)
    dist = {}
    for p in profiles:
        label = _classify(p.get('contract_type'))
        dist[label] = dist.get(label, 0) + 1
    for label in sorted(dist, key=lambda k: (-dist[k], k)):
        print(f'  {label:12} : {dist[label]}건')
    print()

    # ── 3) 코드 레벨 필터 적용 ────────────────────────────────────────
    print('=' * 64)
    print(f"[3] 코드 레벨 필터 (contract_type == '{EXCLUDED_CONTRACT_TYPE}' 만 제외)")
    print('=' * 64)
    excluded = [p for p in profiles if not is_eligible_for_pptx(p)]

    # filter_eligible_branches 는 제외 원 로그 출력 + 0개 시 예외 (안전장치)
    eligible = filter_eligible_branches(profiles)

    print(f'\n  통과(자격 있음) : {len(eligible)}개')
    print(f'  제외(temporary) : {len(excluded)}개')
    if excluded:
        print('  제외된 short_code 목록:')
        for p in excluded:
            sc = (p.get('short_code') or '').strip() or '(없음)'
            dn = (p.get('display_name') or '').strip() or '(없음)'
            print(f'    - {sc} / {dn}')
    print()

    # ── 4) 예상값 대조 PASS/FAIL ─────────────────────────────────────
    print('=' * 64)
    print('[4] 예상값 대조')
    print('=' * 64)
    ok_eligible = (len(eligible) == EXPECTED_ELIGIBLE)
    ok_excluded = (len(excluded) == EXPECTED_EXCLUDED)
    print(f'  통과 {len(eligible)} == 예상 {EXPECTED_ELIGIBLE}  → '
          f'{"PASS" if ok_eligible else "FAIL"}')
    print(f'  제외 {len(excluded)} == 예상 {EXPECTED_EXCLUDED}  → '
          f'{"PASS" if ok_excluded else "FAIL"}')
    print('  (참고: 크레오 3원은 branch_profiles 행이 없어 미집계 — 50이 정상)')
    print()

    overall = ok_eligible and ok_excluded
    print('=' * 64)
    print(f'  종합 결과: {"PASS ✅" if overall else "FAIL ❌"}')
    print('=' * 64)
    sys.exit(0 if overall else 1)


if __name__ == '__main__':
    main()
