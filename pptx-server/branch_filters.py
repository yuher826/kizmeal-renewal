# -*- coding: utf-8 -*-
"""
branch_filters.py — 원(branch) 배포 자격 필터 (코드 레벨)

★ 설계 제약
  contract_type 필터링은 반드시 "DB에서 가져온 뒤 코드 레벨에서" 수행한다.
  Supabase REST(filters=)에 contract_type 조건을 넣지 않는다.
  이유: PostgREST의 neq.temporary 는 SQL 3값 논리 때문에 contract_type IS NULL 행을
        결과에서 제외시킨다. 현재 branch_profiles 는 contract_type 이 NULL 다수 /
        temporary 소수 이므로, DB 필터로 처리하면 NULL 원이 전부 배포에서 사라진다.
  따라서 filters={'contract_status': 'active'} 는 그대로 두고, 여기서 한 겹 더 거른다.

  자격 규칙: contract_type == 'temporary' 인 원만 제외.
            None / 빈 문자열 / 'permanent' 등 그 외 값은 전부 통과(자격 있음).
"""

# 배포에서 제외할 계약유형 값 (임시 계약 원)
EXCLUDED_CONTRACT_TYPE = 'temporary'


def is_eligible_for_pptx(profile: dict) -> bool:
    """
    단일 원 프로파일이 PPTX 생성·배포 대상인지 판정한다.

    - contract_type == 'temporary' → False (제외)
    - 그 외(None / 빈 문자열 / 'permanent' 등) → True (자격 있음)

    ※ 반드시 .get() 으로 접근한다. contract_type 키가 없는 dict 도 안전하게 True 로 처리.
    """
    return profile.get('contract_type') != EXCLUDED_CONTRACT_TYPE


def filter_eligible_branches(profiles: list) -> list:
    """
    프로파일 리스트에서 배포 자격이 있는 원만 남긴다.

    - 제외된 원은 short_code / display_name 을 한글 로그로 출력한다.
    - 결과가 0개면 (안전장치) 명확한 한글 에러와 함께 예외를 발생시킨다.
      → 전멸(전체 원이 사라지는) 상황을 조용히 통과시키지 않기 위함.
    """
    eligible = []
    excluded = []

    for p in profiles:
        if is_eligible_for_pptx(p):
            eligible.append(p)
        else:
            excluded.append(p)

    if excluded:
        print(f'  [배포 제외] 임시 계약(temporary) 원 {len(excluded)}개 제외:')
        for p in excluded:
            short_code   = (p.get('short_code') or '').strip() or '(short_code 없음)'
            display_name = (p.get('display_name') or '').strip() or '(display_name 없음)'
            print(f'    - {short_code} / {display_name}')

    if not eligible:
        raise RuntimeError(
            '배포 자격이 있는 원이 0개입니다. '
            f'(전체 {len(profiles)}개, 임시계약 제외 {len(excluded)}개) — '
            '필터 조건 또는 원본 데이터를 확인하세요. 배포를 중단합니다.'
        )

    return eligible
