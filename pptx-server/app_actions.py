# -*- coding: utf-8 -*-
"""
GitHub Actions PPTX 자동생성 스크립트
========================================================================
환경변수:
  SUPABASE_URL         — Supabase 프로젝트 URL
  SUPABASE_SERVICE_KEY — service_role 키
  YEAR                 — 년도 (예: 2026)
  MONTH                — 월 (예: 6)

실행:
  python pptx-server/app_actions.py

⚠️ 일본어 금지.
"""

import gc
import os
import shutil
import sys
import tempfile
from datetime import date as _date_cls

# pptx-server 디렉토리를 모듈 경로에 추가
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from bracket_parser import wants_fruit
from branch_filters import filter_eligible_branches
from pptx_generator import generate as gen_pptx
from read_excel import _embed_brackets, _inject_exception_to_banchan, convert_pptx, determine_type
from supabase_uploader import SupabaseREST
from template_resolver import (
    VARIANT_LABEL, cleanup_template_set, fetch_vacation_map, pick_template, resolve_template_set,
)
from validate_template import validate_template

# ── 환경변수 ───────────────────────────────────────────────────────
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
YEAR         = int(os.environ['YEAR'])
MONTH        = int(os.environ['MONTH'])

TEMPLATE_PATH = os.path.join(_HERE, 'templates', '2026년 6월 식단표(양식).pptx')
_BUCKET       = 'diet-files'
_BATCH        = 5

client = SupabaseREST(SUPABASE_URL, SUPABASE_KEY)


# ════════════════════════════════════════════════════════════════════
# TypeScript → Python 어댑터 (app.py 로직 재활용)
# ════════════════════════════════════════════════════════════════════
def _adapt_ts_day(ts_day):
    lunch_raw = ts_day.get('lunch', {})
    am_raw    = ts_day.get('morning_snack', {})
    pm_raw    = ts_day.get('afternoon_snack', {})
    care_raw  = ts_day.get('care_snack', {})

    lunch_spec = lunch_raw.get('special', '')
    lunch_exc  = lunch_raw.get('exception', '')

    banchans = {k: lunch_raw.get(k, '') for k in
                ('banchan1', 'banchan2', 'banchan3', 'banchan4', 'banchan5')}
    if lunch_exc:
        _inject_exception_to_banchan(banchans, lunch_exc)

    am_menu = _embed_brackets(
        am_raw.get('menu', ''), am_raw.get('special', ''), am_raw.get('exception', ''),
    )
    pm_menu = _embed_brackets(
        pm_raw.get('menu', ''), pm_raw.get('special', ''), pm_raw.get('exception', ''),
        lunch_spec,
    )

    bap = lunch_raw.get('bap', '')
    return {
        'date':            ts_day.get('date', ''),
        'is_holiday':      ts_day.get('is_holiday', False) or not bool(bap),
        'is_birthday':     ts_day.get('is_birthday', False),
        'is_skipped':      False,
        'lunch': {
            'bap':       bap,
            'guk':       lunch_raw.get('guk', ''),
            'banchan1':  banchans['banchan1'],
            'banchan2':  banchans['banchan2'],
            'banchan3':  banchans['banchan3'],
            'banchan4':  banchans['banchan4'],
            'banchan5':  banchans['banchan5'],
            'nutrition': lunch_raw.get('nutrition', ''),
            'has_fruit': wants_fruit(lunch_spec),
        },
        'morning_snack':   {'menu': am_menu,  'nutrition': am_raw.get('nutrition', '')},
        'afternoon_snack': {'menu': pm_menu,  'nutrition': pm_raw.get('nutrition', '')},
        'care_snack':      {'menu': care_raw.get('menu', ''), 'nutrition': care_raw.get('nutrition', '')},
    }


def _adapt_ts_week(ts_week):
    if not ts_week or ts_week.get('is_skipped'):
        return None
    ordered = [None] * 5
    for raw_day in ts_week.get('days', []):
        date_str = raw_day.get('date', '')
        try:
            d  = _date_cls.fromisoformat(date_str)
            wd = d.weekday()
            if 0 <= wd <= 4:
                ordered[wd] = _adapt_ts_day(raw_day)
        except (ValueError, AttributeError):
            pass
    return {'wk': ts_week.get('week_num'), 'days': ordered}


def _adapt_ts_menu_data(raw_menu_data):
    adapted_weeks = {}
    for key, ts_week in raw_menu_data.get('weeks', {}).items():
        adapted = _adapt_ts_week(ts_week)
        if adapted is not None:
            adapted_weeks[str(key)] = adapted
    return {
        'year':          raw_menu_data.get('year'),
        'month':         raw_menu_data.get('month'),
        'weeks':         adapted_weeks,
        'origin_text':   raw_menu_data.get('origin_text'),   # 원산지 텍스트 (DB 저장값 pass-through)
        'material_text': raw_menu_data.get('material_text'), # 원재료 텍스트 (DB 저장값 pass-through)
    }


def _build_date_map(adapted):
    weeks = adapted.get('weeks', {})

    def _day_num(wk_str, slot_idx):
        wdata = weeks.get(wk_str)
        if not wdata:
            return ''
        days = wdata.get('days', [])
        if slot_idx < len(days) and days[slot_idx]:
            date_str = days[slot_idx].get('date', '')
            return date_str.split('-')[2] if len(date_str) == 10 else date_str
        return ''

    return {
        '09': _day_num('2', 1),
        '10': _day_num('2', 2),
        '16': _day_num('3', 1),
        '17': _day_num('3', 2),
    }


# ════════════════════════════════════════════════════════════════════
# DB 조회
# ════════════════════════════════════════════════════════════════════
def fetch_menu_data():
    rows = client.select(
        'weekly_menus', 'id,menu_data',
        filters={'year': YEAR, 'month': MONTH, 'diet_type': 'CK', 'branch_id': None},
    )
    if not rows or not rows[0].get('menu_data'):
        raise RuntimeError(f'{YEAR}년 {MONTH}월 CK 식단 데이터가 없습니다.')
    return rows[0]['menu_data']


def fetch_diet_settings():
    """diet_settings 테이블에서 key/value 전체 조회 → {key: value} 딕셔너리 반환."""
    try:
        rows = client.select('diet_settings', 'key,value')
        return {row['key']: row['value'] for row in rows if row.get('key')}
    except Exception as exc:
        print(f'  [diet_settings 조회 실패] {exc}')
        return {}


def fetch_branch_cfgs():
    profiles = client.select(
        'branch_profiles',
        'id,branch_id,short_code,display_name,branch_full_name,distribution_email,distribution_emails,'
        'slide_count,snack_morning,snack_afternoon,snack_childcare,'
        'needs_english,has_yonder,has_dessert_fruit,file_format,contract_type,'
        'snack_label,morning_snack_fixed,morning_snack_fixed_menu',
        filters={'contract_status': 'active'},
    )
    # 임시원(contract_type='temporary') 코드 레벨 제외. 0개면 예외 → GH Actions 실패(의도된 안전장치)
    profiles = filter_eligible_branches(profiles)
    cfgs = []
    for p in profiles:
        short_code = (p.get('short_code') or '').strip()
        if not short_code:
            continue

        has_am = 'O' if p.get('snack_morning') else ''
        has_pm = 'O' if p.get('snack_afternoon') else ''
        care   = 'O' if p.get('snack_childcare') else ''
        eng    = 'O' if p.get('needs_english') else ''
        note   = 'Yonder' if p.get('has_yonder') else ''
        slides = str(p.get('slide_count', 1)) + 'P'

        type_code = determine_type(slides, has_am, has_pm, care, note, eng)

        raw_lbl   = (p.get('snack_label') or '').strip()
        snack_lbl = '간식' if raw_lbl == '간식' else '오전'

        email = (p.get('distribution_email') or '').strip()
        if not email:
            emails = p.get('distribution_emails') or []
            email  = emails[0] if emails else ''

        fixed_am = None
        if p.get('morning_snack_fixed') and p.get('morning_snack_fixed_menu'):
            fixed_am = {'menu': p['morning_snack_fixed_menu'], 'nutrition': ''}

        branch_uuid = p.get('id')
        if not branch_uuid:
            print(f'  [경고] branch_id 없음 — 스킵: {short_code}')
            continue

        cfgs.append({
            'name':             short_code,
            'display_name':     (p.get('display_name') or short_code).strip(),
            'branch_full_name': (p.get('branch_full_name') or p.get('display_name') or short_code).strip(),
            'email':            email,
            'type':         type_code,
            'snack_label':  snack_lbl,
            'add_fruit':    bool(p.get('has_dessert_fruit', False)),
            'fruit_text':   '제철과일',
            'file_fmt':     (p.get('file_format') or 'PDF').upper(),
            'use_pm_as_am': (not p.get('snack_morning') and bool(p.get('snack_afternoon'))),
            'fixed_am':     fixed_am,
            'branch_uuid':  branch_uuid,
        })
    return cfgs


# ════════════════════════════════════════════════════════════════════
# Storage 업로드
# ════════════════════════════════════════════════════════════════════
_MIME_BY_EXT = {
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
}


def upload_file(local_path, storage_path):
    """확장자로 mime 자동 판별해 업로드. 성공 시 public URL, 실패 시 '' 반환."""
    ext = os.path.splitext(local_path)[1].lower()
    mime = _MIME_BY_EXT.get(ext, 'application/octet-stream')
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


# 하위호환: 기존 이름으로도 호출 가능
upload_pptx = upload_file


# ════════════════════════════════════════════════════════════════════
# weekly_menus 업서트
# ════════════════════════════════════════════════════════════════════
def upsert_branch_row(branch_id, status, pptx_url, pdf_url=None):
    # 기존 행 조회 — approved/deployed 상태이면 status 덮어쓰기 금지
    existing = client.select(
        'weekly_menus', 'id,status',
        filters={'branch_id': branch_id, 'year': YEAR, 'month': MONTH, 'diet_type': 'CK'},
    )
    if existing and existing[0].get('status') in ('approved', 'deployed'):
        # 이미 승인/배포된 원: pptx_url/pdf_url만 갱신, status 보존 (학부모 포털 유지)
        client.update(
            'weekly_menus',
            {'pptx_url': pptx_url or None, 'pdf_url': pdf_url or None},
            filters={'id': existing[0]['id']},
        )
        return existing[0]['id']

    client.upsert(
        'weekly_menus',
        {
            'branch_id': branch_id,
            'year':      YEAR,
            'month':     MONTH,
            'diet_type': 'CK',
            'status':    status,
            'pptx_url':  pptx_url or None,
            'pdf_url':   pdf_url or None,
        },
        on_conflict='branch_id,year,month,diet_type',
    )
    rows = client.select(
        'weekly_menus', 'id',
        filters={'branch_id': branch_id, 'year': YEAR, 'month': MONTH, 'diet_type': 'CK'},
    )
    return rows[0]['id'] if rows else None


def update_common_row_status(status):
    try:
        rows = client.select(
            'weekly_menus', 'id',
            filters={'year': YEAR, 'month': MONTH, 'diet_type': 'CK', 'branch_id': None},
        )
        if rows:
            client.update('weekly_menus', {'status': status}, filters={'id': rows[0]['id']})
    except Exception as exc:
        print(f'[공통 row 업데이트 오류] {exc}')


def upsert_diet_review_item(weekly_menu_id, branch_uuid, branch_name, pptx_url, pdf_url=None, jpg_url=None):
    existing = client.select(
        'diet_review_items', 'id,review_status',
        filters={'weekly_menu_id': weekly_menu_id, 'branch_id': branch_uuid},
    )
    if existing:
        row = existing[0]
        update_data = {
            'pptx_url': pptx_url or None,
            'pdf_url':  pdf_url or None,
            'jpg_url':  jpg_url or None,
        }
        # deployed 상태가 아닌 경우에만 review_status 를 재생성 완료로 초기화
        if row.get('review_status') != 'deployed':
            update_data['review_status'] = 'generation_complete'
        client.update(
            'diet_review_items',
            update_data,
            filters={'id': row['id']},
        )
    else:
        client.insert(
            'diet_review_items',
            {
                'weekly_menu_id': weekly_menu_id,
                'branch_id':      branch_uuid,
                'branch_name':    branch_name,
                'pptx_url':       pptx_url or None,
                'pdf_url':        pdf_url or None,
                'jpg_url':        jpg_url or None,
                'review_status':  'generation_complete',
            },
        )


# ════════════════════════════════════════════════════════════════════
# 템플릿 결정
# ════════════════════════════════════════════════════════════════════
# 실제 로직은 template_resolver.py(app.py와 공용)로 이전됨 — 로직을 두 벌로
# 두면 한쪽만 고치는 사고가 난다(board/erp 중복본 정리 때 겪은 것과 동일 패턴).
def _resolve_template_set():
    """그 달 템플릿을 variant별로 준비한다. 반환: {variant: (경로, 출처설명)}
    임시파일이 만들어지므로 main()에서 생성 종료 후 cleanup_template_set()으로 정리."""
    return resolve_template_set(client, TEMPLATE_PATH, YEAR, MONTH)


# ════════════════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════════════════
def main():
    print(f'[Actions] PPTX 생성 시작 — {YEAR}년 {MONTH}월')

    # ── 템플릿 결정 + 검증 (생성 전 문지기) ──
    print('[검증] 사용할 템플릿 결정 + 이름표/구조 확인...')
    tpl_set = _resolve_template_set()
    if tpl_set:
        for _v, (_p, _src) in sorted(tpl_set.items()):
            print(f'  최종 사용 템플릿[{_v}]: {_src}')
    else:
        print('  최종 사용 템플릿: 로컬(업로드없음)')

    # 최종 결정된 템플릿을 한 번 더 검증 (로컬이든 업로드든).
    # 방학 O/X면 2벌이므로 준비된 것 전부를 본다 — 한 벌만 깨져도 그 원들이
    # 조용히 잘못 생성되므로 생성 전에 막는다.
    _check_paths = [p for p, _ in tpl_set.values()] or [TEMPLATE_PATH]
    for _path in _check_paths:
        with open(_path, 'rb') as _tf:
            _tpl_bytes = _tf.read()
        _vr = validate_template(_tpl_bytes)
        print(f'  {_vr["summary"]}')
        for _s in _vr['slides']:
            _mark = 'O' if _s['valid'] else 'X'
            print(f'    [{_mark}] {_s["slide"]}: 누락={_s["missing"]} 컬럼={_s["columns"]}')
        if not _vr['valid']:
            print('[중단] 템플릿 검증 실패 — 생성을 시작하지 않습니다.')
            cleanup_template_set(tpl_set, TEMPLATE_PATH)
            sys.exit(1)
    print('[검증] 통과 — 생성을 진행합니다.')

    # 원별 방학 배정 (방학 없는 달이면 빈 dict)
    vacation_map = fetch_vacation_map(client, YEAR, MONTH)

    print('[1/4] menu_data 조회...')
    raw_menu_data = fetch_menu_data()

    print('[2/4] branch_profiles 조회...')
    branch_cfgs = fetch_branch_cfgs()
    print(f'  → {len(branch_cfgs)}개 원 로드')

    print('[3/4] 메뉴 데이터 변환...')
    adapted_menu = _adapt_ts_menu_data(raw_menu_data)
    date_map     = _build_date_map(adapted_menu)

    settings = fetch_diet_settings()
    if settings.get('origin_body'):
        origin_text = {
            'body':       settings['origin_body'],
            'disclaimer': settings.get('origin_disclaimer', ''),
        }
    else:
        origin_text = None
    material_text = settings.get('material_text')

    print(f'[4/4] PPTX 생성 시작 (배치: {_BATCH}개씩)...')
    tmp_dir   = tempfile.mkdtemp(prefix='kizmeal_actions_')
    succeeded = 0
    failed    = 0
    lo_missing = False  # LibreOffice 미설치 확인되면 True — 이후 변환 시도 자체를 건너뜀
    # variant('vacation_on'/'vacation_off'/'none') 또는 '로컬폴백' → 사용 원 수.
    # 2026-08-25 — 방학 variant 오배정 방지 작업의 배정 요약용.
    tpl_tally = {}

    try:
        for batch_start in range(0, len(branch_cfgs), _BATCH):
            for cfg in branch_cfgs[batch_start:batch_start + _BATCH]:
                branch_uuid  = cfg['branch_uuid']
                branch_uuid8 = branch_uuid[:8]
                short_code   = cfg['name']
                fname        = f'{branch_uuid8}_{YEAR}{MONTH:02d}.pptx'
                out_pptx     = os.path.join(tmp_dir, fname)
                storage_path = f'{YEAR}/{MONTH:02d}/{fname}'

                # 원별 방학 배정으로 양식 선택 (평월은 variant가 하나뿐)
                tpl_path, tpl_source = pick_template(
                    tpl_set, TEMPLATE_PATH,
                    vacation_map.get(branch_uuid), short_code,
                )
                # 정상 매칭은 조용히 집계만, none 폴백은 원별로 로그.
                # 로컬 폴백 경고는 pick_template()이 이미 찍었으므로 여기선 집계만.
                if tpl_source in ('로컬(업로드없음)', '로컬(방학양식 미비)'):
                    tpl_tally['로컬폴백'] = tpl_tally.get('로컬폴백', 0) + 1
                elif 'none폴백' in tpl_source:
                    tpl_tally['none'] = tpl_tally.get('none', 0) + 1
                    print(f'  [템플릿] {short_code}: {tpl_source}')
                else:
                    _used = next((k for k, (p, _s) in tpl_set.items() if p == tpl_path), '?')
                    tpl_tally[_used] = tpl_tally.get(_used, 0) + 1

                try:
                    gen_pptx(
                        cfg, adapted_menu, tpl_path, out_pptx,
                        date_map=date_map,
                        origin_text=origin_text,
                        material_text=material_text,
                    )
                    pptx_url = upload_file(out_pptx, storage_path)

                    # ── PDF/JPG 변환 (file_fmt 기준) ──
                    pdf_url = ''
                    jpg_url = ''
                    file_fmt = cfg.get('file_fmt', 'PDF')
                    if not lo_missing and file_fmt.upper() != 'PPT':
                        converted = convert_pptx(out_pptx, file_fmt)
                        if converted is None:
                            # soffice 자체가 없음 — 이번 실행 전체에서 변환 포기(반복 실패 방지)
                            lo_missing = True
                            print('  ⚠️  LibreOffice 미설치 — 이후 전체 변환 건너뜀 (PPTX는 정상 생성됨)')
                        else:
                            for conv_path in converted:
                                conv_ext  = os.path.splitext(conv_path)[1]  # '.pdf' or '.jpg'
                                conv_name = f'{branch_uuid8}_{YEAR}{MONTH:02d}{conv_ext}'
                                conv_storage = f'{YEAR}/{MONTH:02d}/{conv_name}'
                                url = upload_file(conv_path, conv_storage)
                                if conv_ext == '.pdf':
                                    pdf_url = url
                                elif conv_ext == '.jpg':
                                    jpg_url = url

                    weekly_menu_id = upsert_branch_row(branch_uuid, 'generation_complete', pptx_url, pdf_url)
                    if weekly_menu_id:
                        upsert_diet_review_item(
                            weekly_menu_id,
                            branch_uuid,
                            cfg.get('branch_full_name') or cfg['display_name'],
                            pptx_url,
                            pdf_url,
                            jpg_url,
                        )
                    print(f'  ✅ {short_code}')
                    succeeded += 1
                except Exception as exc:
                    print(f'  ❌ {short_code}: {exc}')
                    upsert_branch_row(branch_uuid, 'error', '')
                    failed += 1
            gc.collect()

        # 배정 요약 — 방학O/방학X/none/로컬폴백을 항상 한 줄로 (0건도 표시해
        # 이상을 바로 알아챌 수 있게 한다)
        _tally_order = list(VARIANT_LABEL) + ['로컬폴백']
        _tally_parts = [f'{VARIANT_LABEL.get(k, k)} {tpl_tally.get(k, 0)}원' for k in _tally_order]
        _tally_leftover = {k: v for k, v in tpl_tally.items() if k not in _tally_order}
        if _tally_leftover:
            _tally_parts += [f'{k} {v}원' for k, v in sorted(_tally_leftover.items())]
        print(f'  [템플릿] 배정 요약 — {" / ".join(_tally_parts)}')
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        cleanup_template_set(tpl_set, TEMPLATE_PATH)

    print(f'\n[완료] 성공 {succeeded}개 / 실패 {failed}개 / 전체 {len(branch_cfgs)}개')

    # 공통 row 상태 업데이트
    final_status = 'generation_complete' if succeeded > 0 else 'error'
    update_common_row_status(final_status)

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
