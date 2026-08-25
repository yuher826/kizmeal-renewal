# -*- coding: utf-8 -*-
"""
템플릿 결정 — 업로드본 vs 로컬 폴백 (GitHub Actions·Render 공용)
========================================================================
diet_templates(해당 연/월 + active) 조회 → Storage 다운로드 → 이름표 자동
부여(발견①) → 검증 → 통과 시 사용, 실패/없음 시 로컬 TEMPLATE_PATH로 폴백.

`app_actions.py`(GitHub Actions, 프로세스 단위 단명)와 `app.py`(Render,
장기 실행 gunicorn 워커) 둘 다 이 모듈을 통해서만 템플릿을 결정한다.
로직을 두 벌로 두면 한쪽만 고치는 사고가 난다
(board/erp 중복본 정리 때 겪은 것과 동일 패턴 — HANDOFF.md 참고).

■ 방학 O/X — "연·월당 템플릿 1개" 전제를 깬 이유
디자이너는 방학 있는 달에 방학O·방학X **공용 양식 2벌**을 준다. 어느 원이
O고 어느 원이 X인지는 디자이너가 모르는 우리 쪽 정보라, 원별 배정표
(branch_monthly_vacation)를 우리가 갖고 고른다. 방학 그림 자체를 코드가
삽입·크기조정할 필요는 없다(HANDOFF 발견③) — 양식만 고르면 된다.

그래서 API가 둘로 나뉜다:
  · resolve_template_set()  — 그 달 템플릿을 variant별로 **한 번씩만** 준비
                              (다운로드·이름표·검증은 원 수와 무관하게 1회)
  · pick_template()         — 원별 방학 여부로 그중 하나를 고른다
평월(방학 없는 달)은 variant가 'none' 하나뿐이라 기존과 동일하게 동작한다.

⚠️ 일본어 금지.
"""

import os
import tempfile

from template_namer import apply_template_names
from validate_template import validate_template


def log_validate_fail(client, template_id, message, detail=None):
    """폴백 발생 시 template_logs에 기록. (업로드 자체가 없는 정상 상황은 기록 안 함)"""
    try:
        client.insert('template_logs', {
            'template_id': template_id,
            'action':      'validate_fail',
            'detail':      {'message': message, **(detail or {})},
        })
    except Exception as e:
        print(f'  [template_logs 기록 실패] {e}')


#: 방학 축 값. diet_templates.vacation_variant CHECK와 동일해야 한다
VARIANT_NONE = 'none'
VARIANT_ON   = 'vacation_on'
VARIANT_OFF  = 'vacation_off'

#: variant → 한글 라벨 (호출부의 배정 요약 로그용, 2026-08-25)
VARIANT_LABEL = {
    VARIANT_ON:   '방학O',
    VARIANT_OFF:  '방학X',
    VARIANT_NONE: 'none',
}


def fetch_vacation_map(client, year, month):
    """
    branch_monthly_vacation에서 그 달의 원별 방학 배정을 읽는다.

    반환: {branch_profile_id(uuid): has_vacation(bool)}
          조회 실패·미설정이면 {} — pick_template이 방학X로 보수 처리한다.

    ★키가 branch_profiles.id인 점에 주의. weekly_menus·diet_review_items는
      branches.id를 쓰지만 이 기능 계열은 branch_profiles.id로 통일했다
      (add_holiday_exceptions_260820.sql 설계 결정 2).
      app_actions.py의 cfg['branch_uuid']와 app.py의 _get_branch_id_map()
      값이 둘 다 branch_profiles.id라 그대로 맞물린다.
    """
    try:
        rows = client.select(
            'branch_monthly_vacation', 'branch_profile_id,has_vacation',
            filters={'year': year, 'month': month},
        )
    except Exception as e:
        print(f'  [방학] 배정 조회 실패 → 전 원 방학X로 처리: {e}')
        return {}

    vmap = {
        r['branch_profile_id']: bool(r.get('has_vacation'))
        for r in rows or []
        if r.get('branch_profile_id')
    }
    if vmap:
        on = sum(1 for v in vmap.values() if v)
        print(f'  [방학] {year}년 {month}월 배정 {len(vmap)}개 원 (방학O {on} / 방학X {len(vmap) - on})')
    return vmap


def resolve_template_set(client, local_fallback_path, year, month):
    """
    그 달의 active 템플릿을 vacation_variant별로 준비한다.

    반환: {variant: (경로, 출처설명)}
          업로드본이 없거나 전부 실패하면 {} (호출자는 로컬 폴백)

    다운로드·이름표 부여·검증은 **variant당 한 번씩만** 수행한다.
    원이 49개든 1개든 이 비용은 동일하다.

    ⚠️ 반환된 경로들은 임시파일이므로 사용 후 반드시
       cleanup_template_set()으로 정리할 것.
    """
    # DB에서 '이번 생성 대상 연/월'의 active 템플릿만 조회 (boolean은 소문자 문자열로)
    #   ★ year/month로 반드시 필터링 — 안 하면 다른 달 템플릿이 active로 남아있을 때
    #     엉뚱한 달 내용으로 잘못 생성됨 (is_active는 테이블 전체에서 1개만 허용되는
    #     전역 플래그라 연/월 매칭 없이는 "어느 달이든 최근 active"를 그대로 씀).
    #   ★ created_at desc 정렬 — 같은 variant에 active가 여러 개 걸려도 최신 것 사용.
    try:
        rows = client.select(
            'diet_templates', 'id,file_path,name,created_at,vacation_variant',
            filters={'is_active': 'true', 'year': year, 'month': month},
            order='created_at.desc',
        )
    except Exception as e:
        print(f'  [템플릿] DB 조회 실패 → 로컬 사용: {e}')
        return {}

    if not rows:
        print(f'  [템플릿] {year}년 {month}월 업로드된 active 템플릿 없음 → 로컬 사용')
        return {}

    # variant별로 최신 1개만 남긴다 (rows가 created_at desc라 첫 등장이 최신)
    by_variant = {}
    for row in rows:
        variant = (row.get('vacation_variant') or VARIANT_NONE).strip() or VARIANT_NONE
        if variant in by_variant:
            print(f'  [템플릿] ⚠️ {year}년 {month}월 "{variant}" active 템플릿이 여러 개'
                  f' (정상이면 1개) → 최신 것만 사용')
            continue
        by_variant[variant] = row

    resolved = {}
    for variant, tpl in by_variant.items():
        path, source = _prepare_template(client, tpl, local_fallback_path)
        if path != local_fallback_path:
            resolved[variant] = (path, source)
        else:
            # 준비 실패 — 이 variant는 로컬 폴백. 다른 variant는 계속 시도한다
            print(f'  [템플릿] "{variant}" 준비 실패 → 이 variant는 로컬 사용 ({source})')

    if len(resolved) > 1:
        print(f'  [템플릿] 방학 양식 {len(resolved)}종 준비됨: {sorted(resolved)}')

    return resolved


def pick_template(tpl_set, local_fallback_path, has_vacation=None, branch_name=''):
    """
    원 하나가 쓸 템플릿 경로를 고른다.

    has_vacation: True=방학O / False=방학X / None=미설정(평월이거나 배정 누락)
    반환: (경로, 출처설명)

    우선순위 — 원하는 variant → 'none' → 로컬 폴백.

    ⚠️ 2026-08-25 수정 — 반대편 variant(방학O를 원하는데 방학X만 준비된
    경우 등)는 폴백 후보에서 뺐다. 아래 "방학 배정 없음" 분기가 선언하는
    원칙("없는 그림이 빠지는 쪽이 엉뚱한 방학 그림이 붙는 쪽보다 덜
    틀리다")을 이 order 배열도 지키게 하기 위함이다. 예전엔 order에
    반대편까지 들어 있어서, 방학O만 업로드되고 방학X가 아직 안 올라온
    달에 비방학 원이 방학O를 받는 사고 경로가 있었다.
    """
    if not tpl_set:
        return local_fallback_path, '로컬(업로드없음)'

    has_vacation_axis = VARIANT_ON in tpl_set or VARIANT_OFF in tpl_set

    if has_vacation is None and has_vacation_axis:
        # 방학 양식이 올라온 달인데 그 원의 배정이 없다 — 데이터 공백이다.
        # 49개 원 생성을 통째로 세울 수는 없으므로 '방학X'로 보수적으로 처리하고
        # 원 이름을 찍어 추적 가능하게 한다. 없는 그림이 빠지는 쪽이
        # 엉뚱한 방학 그림이 붙는 쪽보다 덜 틀리다.
        print(f'  [템플릿] ⚠️ 방학 배정 없음 → 방학X로 처리: {branch_name or "(이름없음)"}')
        has_vacation = False

    # 원하는 variant → none. 반대편 variant는 넣지 않는다(위 docstring 참고).
    if has_vacation is True:
        order = (VARIANT_ON, VARIANT_NONE)
    elif has_vacation is False:
        order = (VARIANT_OFF, VARIANT_NONE)
    else:
        # ★155행 has_vacation_axis 정의상 이 분기에 도달했다면 tpl_set엔
        #   none만 있을 수 있다(ON/OFF가 있었다면 위에서 이미 False로
        #   바뀌었을 것). 그래도 OFF/ON을 남겨두면 나중에 155행 로직이
        #   바뀔 때 조용히 구멍이 된다 — none 하나로 좁혀 만에 하나의
        #   경우도 로컬 폴백으로 안전하게 빠지게 한다.
        order = (VARIANT_NONE,)

    for pos, variant in enumerate(order):
        if variant in tpl_set:
            path, source = tpl_set[variant]
            if pos == 0:
                return path, source
            # pos > 0 은 order 길이가 2일 때만 있고, 그때 order[1]은 항상
            # VARIANT_NONE — 원하는 방학 variant가 없어 none으로 대신 쓰는
            # 경우다. 호출부가 이 경우만 골라 로그를 남길 수 있도록
            # 출처 문자열에 표시해 둔다.
            return path, f'{source} (none폴백·기대={order[0]})'

    # 원하는 variant도 none도 준비되지 않음 — 반대편 variant는 절대 쓰지
    # 않고 로컬로 빠진다.
    # 로컬(6월 양식)은 그 달 배치와 안 맞을 수 있지만, 지금 이 순간 모든
    # 원이 이미 로컬을 쓰고 있다(v1의 year/month가 NULL이라
    # resolve_template_set()의 필터에 안 걸림 — HANDOFF "신규 발견" 참고).
    # 즉 후퇴가 아니라 현재 기준선이고, 반대편 방학 그림 오배정은
    # 그 기준선보다 명백히 나쁘다.
    print(f'  [템플릿] ⚠️ 방학 양식 미비 → 로컬 폴백: {branch_name or "(이름없음)"}'
          f' (기대 variant={order[0]}, 준비된 variant={sorted(tpl_set)})')
    return local_fallback_path, '로컬(방학양식 미비)'


def cleanup_template_set(tpl_set, local_fallback_path):
    """resolve_template_set()이 만든 임시파일들을 정리한다."""
    for path, _ in (tpl_set or {}).values():
        cleanup_template_path(path, local_fallback_path)


def _prepare_template(client, tpl, local_fallback_path):
    """템플릿 행 하나를 다운로드 → 이름표 부여 → 검증 → 임시파일로 준비.

    반환: (경로, 출처설명). 실패 시 (local_fallback_path, 사유).
    """
    tpl_id    = tpl.get('id')
    file_path = tpl.get('file_path')
    tpl_name  = tpl.get('name', '?')

    # 1) Storage에서 다운로드
    try:
        tpl_bytes = client.download_file('diet-templates', file_path)
    except Exception as e:
        print(f'  [템플릿] 다운로드 실패 → 로컬 사용: {e}')
        log_validate_fail(client, tpl_id, f'다운로드 실패: {e}')
        return local_fallback_path, '로컬(다운실패)'

    # 2) 이름표 자동 부여 (발견① — 디자이너는 이름표를 붙이지 않으므로 코드가 보장)
    try:
        tpl_bytes, name_report = apply_template_names(tpl_bytes)
        for slide_name, info in name_report.items():
            line = f'  [이름표] {slide_name}: 부여={info["applied"]} 누락={info["missing"]}'
            if info['warnings']:
                line += f' 경고={info["warnings"]}'
            print(line)
    except Exception as e:
        print(f'  [템플릿] 이름표 부여 실패 → 로컬 폴백: {e}')
        log_validate_fail(client, tpl_id, f'이름표 부여 예외: {e}')
        return local_fallback_path, f'로컬(이름표부여실패: {tpl_name})'

    # 3) 검증 (검증=생성 같은 눈)
    vr = validate_template(tpl_bytes)
    if not vr['valid']:
        print(f'  [템플릿] 업로드본 "{tpl_name}" 검증 실패 → 로컬 폴백')
        print(f'    {vr["summary"]}')
        log_validate_fail(client, tpl_id, vr['summary'], {'validation': vr})
        return local_fallback_path, f'로컬(업로드검증실패: {tpl_name})'

    # 4) 검증 통과 → 임시파일로 저장 후 그 경로 사용
    tmp = tempfile.NamedTemporaryFile(suffix='.pptx', delete=False)
    tmp.write(tpl_bytes)
    tmp.close()
    print(f'  [템플릿] 업로드본 "{tpl_name}" 이름표 부여 + 검증 통과 → 사용')
    return tmp.name, f'업로드({tpl_name})'


def cleanup_template_path(resolved_path, local_fallback_path):
    """임시파일 하나를 정리. 로컬 폴백 경로는 건드리지 않음.
    (보통은 cleanup_template_set()을 쓴다 — 이건 그 안에서 쓰이는 단건 버전)

    GitHub Actions(app_actions.py)는 프로세스 단위 단명이라 정리 안 해도 원래
    안전하지만, app.py(Render)는 gunicorn 워커가 장기 실행되므로 정리 안 하면
    요청마다 임시파일이 계속 쌓인다 — 두 호출자 모두 반드시 호출할 것."""
    if resolved_path != local_fallback_path:
        try:
            os.remove(resolved_path)
        except OSError:
            pass
