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
from read_excel import _embed_brackets, _inject_exception_to_banchan, determine_type
from supabase_uploader import SupabaseREST
from template_namer import apply_template_names
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
def upload_pptx(local_path, storage_path):
    """업로드 성공 시 public URL, 실패 시 '' 반환."""
    mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
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
# weekly_menus 업서트
# ════════════════════════════════════════════════════════════════════
def upsert_branch_row(branch_id, status, pptx_url):
    # 기존 행 조회 — approved/deployed 상태이면 status 덮어쓰기 금지
    existing = client.select(
        'weekly_menus', 'id,status',
        filters={'branch_id': branch_id, 'year': YEAR, 'month': MONTH, 'diet_type': 'CK'},
    )
    if existing and existing[0].get('status') in ('approved', 'deployed'):
        # 이미 승인/배포된 원: pptx_url만 갱신, status 보존 (학부모 포털 유지)
        client.update(
            'weekly_menus',
            {'pptx_url': pptx_url or None},
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


def upsert_diet_review_item(weekly_menu_id, branch_uuid, branch_name, pptx_url):
    existing = client.select(
        'diet_review_items', 'id,review_status',
        filters={'weekly_menu_id': weekly_menu_id, 'branch_id': branch_uuid},
    )
    if existing:
        row = existing[0]
        update_data = {'pptx_url': pptx_url or None}
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
                'review_status':  'generation_complete',
            },
        )


# ════════════════════════════════════════════════════════════════════
# 템플릿 결정
# ════════════════════════════════════════════════════════════════════
def _log_validate_fail(template_id, message, detail=None):
    """폴백 발생 시 template_logs에 기록. (업로드 자체가 없는 정상 상황은 기록 안 함)"""
    try:
        client.insert('template_logs', {
            'template_id': template_id,
            'action':      'validate_fail',
            'detail':      {'message': message, **(detail or {})},
        })
    except Exception as e:
        print(f'  [template_logs 기록 실패] {e}')


def _resolve_template_path():
    """
    사용할 템플릿 경로를 결정한다.
    업로드 템플릿(diet_templates, 해당 연/월 + active) 우선 → 이름표 자동 부여 →
    검증 통과 시 사용, 없거나 검증 실패 시 → 로컬 TEMPLATE_PATH로 폴백.
    반환: (사용할_경로, 출처설명)
    """
    # 1) DB에서 '이번 생성 대상 연/월'의 active 템플릿만 조회 (boolean은 소문자 문자열로)
    #    ★ year/month로 반드시 필터링 — 안 하면 다른 달 템플릿이 active로 남아있을 때
    #      엉뚱한 달 내용으로 잘못 생성됨 (is_active는 테이블 전체에서 1개만 허용되는
    #      전역 플래그라 연/월 매칭 없이는 "어느 달이든 최근 active"를 그대로 씀).
    #    ★ created_at desc 정렬 — 비정상적으로 active가 여러 개 걸려있어도 최신 것 사용.
    try:
        rows = client.select(
            'diet_templates', 'id,file_path,name,created_at',
            filters={'is_active': 'true', 'year': YEAR, 'month': MONTH},
            order='created_at.desc',
        )
    except Exception as e:
        print(f'  [템플릿] DB 조회 실패 → 로컬 사용: {e}')
        return TEMPLATE_PATH, '로컬(조회실패)'

    if not rows:
        print(f'  [템플릿] {YEAR}년 {MONTH}월 업로드된 active 템플릿 없음 → 로컬 사용')
        return TEMPLATE_PATH, '로컬(업로드없음)'

    if len(rows) > 1:
        print(f'  [템플릿] ⚠️ {YEAR}년 {MONTH}월 active 템플릿이 {len(rows)}개 발견됨'
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
        _log_validate_fail(tpl_id, f'다운로드 실패: {e}')
        return TEMPLATE_PATH, '로컬(다운실패)'

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
        _log_validate_fail(tpl_id, f'이름표 부여 예외: {e}')
        return TEMPLATE_PATH, f'로컬(이름표부여실패: {tpl_name})'

    # 4) 검증 (검증=생성 같은 눈)
    vr = validate_template(tpl_bytes)
    if not vr['valid']:
        print(f'  [템플릿] 업로드본 "{tpl_name}" 검증 실패 → 로컬 폴백')
        print(f'    {vr["summary"]}')
        _log_validate_fail(tpl_id, vr['summary'], {'validation': vr})
        return TEMPLATE_PATH, f'로컬(업로드검증실패: {tpl_name})'

    # 5) 검증 통과 → 임시파일로 저장 후 그 경로 사용
    #    (임시파일은 main()에서 생성 종료 후 정리)
    tmp = tempfile.NamedTemporaryFile(suffix='.pptx', delete=False)
    tmp.write(tpl_bytes)
    tmp.close()
    print(f'  [템플릿] 업로드본 "{tpl_name}" 이름표 부여 + 검증 통과 → 사용')
    return tmp.name, f'업로드({tpl_name})'


# ════════════════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════════════════
def main():
    print(f'[Actions] PPTX 생성 시작 — {YEAR}년 {MONTH}월')

    # ── 템플릿 결정 + 검증 (생성 전 문지기) ──
    print('[검증] 사용할 템플릿 결정 + 이름표/구조 확인...')
    active_template_path, tpl_source = _resolve_template_path()
    print(f'  최종 사용 템플릿: {tpl_source}')

    # 최종 결정된 템플릿을 한 번 더 검증 (로컬이든 업로드든)
    with open(active_template_path, 'rb') as _tf:
        _tpl_bytes = _tf.read()
    _vr = validate_template(_tpl_bytes)
    print(f'  {_vr["summary"]}')
    for _s in _vr['slides']:
        _mark = 'O' if _s['valid'] else 'X'
        print(f'    [{_mark}] {_s["slide"]}: 누락={_s["missing"]} 컬럼={_s["columns"]}')
    if not _vr['valid']:
        print('[중단] 템플릿 검증 실패 — 생성을 시작하지 않습니다.')
        sys.exit(1)
    print('[검증] 통과 — 생성을 진행합니다.')

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

    try:
        for batch_start in range(0, len(branch_cfgs), _BATCH):
            for cfg in branch_cfgs[batch_start:batch_start + _BATCH]:
                branch_uuid  = cfg['branch_uuid']
                branch_uuid8 = branch_uuid[:8]
                short_code   = cfg['name']
                fname        = f'{branch_uuid8}_{YEAR}{MONTH:02d}.pptx'
                out_pptx     = os.path.join(tmp_dir, fname)
                storage_path = f'{YEAR}/{MONTH:02d}/{fname}'

                try:
                    gen_pptx(
                        cfg, adapted_menu, active_template_path, out_pptx,
                        date_map=date_map,
                        origin_text=origin_text,
                        material_text=material_text,
                    )
                    pptx_url = upload_pptx(out_pptx, storage_path)
                    weekly_menu_id = upsert_branch_row(branch_uuid, 'generation_complete', pptx_url)
                    if weekly_menu_id:
                        upsert_diet_review_item(
                            weekly_menu_id,
                            branch_uuid,
                            cfg.get('branch_full_name') or cfg['display_name'],
                            pptx_url,
                        )
                    print(f'  ✅ {short_code}')
                    succeeded += 1
                except Exception as exc:
                    print(f'  ❌ {short_code}: {exc}')
                    upsert_branch_row(branch_uuid, 'error', '')
                    failed += 1
            gc.collect()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        # 업로드본 검증용으로 만든 임시 템플릿 파일 정리 (로컬 TEMPLATE_PATH는 대상 아님)
        if active_template_path != TEMPLATE_PATH:
            try:
                os.remove(active_template_path)
            except OSError:
                pass

    print(f'\n[완료] 성공 {succeeded}개 / 실패 {failed}개 / 전체 {len(branch_cfgs)}개')

    # 공통 row 상태 업데이트
    final_status = 'generation_complete' if succeeded > 0 else 'error'
    update_common_row_status(final_status)

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
