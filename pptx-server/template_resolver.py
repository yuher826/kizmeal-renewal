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


def resolve_template_path(client, local_fallback_path, year, month):
    """
    사용할 템플릿 경로를 결정한다.

    반환: (사용할_경로, 출처설명)

    ⚠️ 반환된 경로가 local_fallback_path와 다르면(=검증 통과한 업로드본을
       담은 임시파일이면) 호출자가 사용 후 반드시 cleanup_template_path()로
       정리해야 한다. 특히 app.py(Render, 장기 실행)는 정리 안 하면
       임시파일이 계속 쌓인다.
    """
    # 1) DB에서 '이번 생성 대상 연/월'의 active 템플릿만 조회 (boolean은 소문자 문자열로)
    #    ★ year/month로 반드시 필터링 — 안 하면 다른 달 템플릿이 active로 남아있을 때
    #      엉뚱한 달 내용으로 잘못 생성됨 (is_active는 테이블 전체에서 1개만 허용되는
    #      전역 플래그라 연/월 매칭 없이는 "어느 달이든 최근 active"를 그대로 씀).
    #    ★ created_at desc 정렬 — 비정상적으로 active가 여러 개 걸려있어도 최신 것 사용.
    try:
        rows = client.select(
            'diet_templates', 'id,file_path,name,created_at',
            filters={'is_active': 'true', 'year': year, 'month': month},
            order='created_at.desc',
        )
    except Exception as e:
        print(f'  [템플릿] DB 조회 실패 → 로컬 사용: {e}')
        return local_fallback_path, '로컬(조회실패)'

    if not rows:
        print(f'  [템플릿] {year}년 {month}월 업로드된 active 템플릿 없음 → 로컬 사용')
        return local_fallback_path, '로컬(업로드없음)'

    if len(rows) > 1:
        print(f'  [템플릿] ⚠️ {year}년 {month}월 active 템플릿이 {len(rows)}개 발견됨'
              f' (정상이면 1개) → 최신 것만 사용')

    tpl = rows[0]
    tpl_id    = tpl.get('id')
    file_path = tpl.get('file_path')
    tpl_name  = tpl.get('name', '?')

    # 2) Storage에서 다운로드
    try:
        tpl_bytes = client.download_file('diet-templates', file_path)
    except Exception as e:
        print(f'  [템플릿] 다운로드 실패 → 로컬 사용: {e}')
        log_validate_fail(client, tpl_id, f'다운로드 실패: {e}')
        return local_fallback_path, '로컬(다운실패)'

    # 3) 이름표 자동 부여 (발견① — 디자이너는 이름표를 붙이지 않으므로 코드가 보장)
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

    # 4) 검증 (검증=생성 같은 눈)
    vr = validate_template(tpl_bytes)
    if not vr['valid']:
        print(f'  [템플릿] 업로드본 "{tpl_name}" 검증 실패 → 로컬 폴백')
        print(f'    {vr["summary"]}')
        log_validate_fail(client, tpl_id, vr['summary'], {'validation': vr})
        return local_fallback_path, f'로컬(업로드검증실패: {tpl_name})'

    # 5) 검증 통과 → 임시파일로 저장 후 그 경로 사용
    tmp = tempfile.NamedTemporaryFile(suffix='.pptx', delete=False)
    tmp.write(tpl_bytes)
    tmp.close()
    print(f'  [템플릿] 업로드본 "{tpl_name}" 이름표 부여 + 검증 통과 → 사용')
    return tmp.name, f'업로드({tpl_name})'


def cleanup_template_path(resolved_path, local_fallback_path):
    """resolve_template_path()가 만든 임시파일이면 정리. 로컬 폴백 경로는 건드리지 않음.

    GitHub Actions(app_actions.py)는 프로세스 단위 단명이라 정리 안 해도 원래
    안전하지만, app.py(Render)는 gunicorn 워커가 장기 실행되므로 정리 안 하면
    요청마다 임시파일이 계속 쌓인다 — 두 호출자 모두 반드시 호출할 것."""
    if resolved_path != local_fallback_path:
        try:
            os.remove(resolved_path)
        except OSError:
            pass
