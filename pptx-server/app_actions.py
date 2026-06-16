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
from pptx_generator import generate as gen_pptx
from read_excel import _embed_brackets, _inject_exception_to_banchan, determine_type
from supabase_uploader import SupabaseREST

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
        'year':  raw_menu_data.get('year'),
        'month': raw_menu_data.get('month'),
        'weeks': adapted_weeks,
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


def fetch_branch_cfgs():
    profiles = client.select(
        'branch_profiles',
        'id,branch_id,short_code,display_name,distribution_email,distribution_emails,'
        'slide_count,snack_morning,snack_afternoon,snack_childcare,'
        'needs_english,has_yonder,has_dessert_fruit,file_format,'
        'snack_label,morning_snack_fixed,morning_snack_fixed_menu',
        filters={'contract_status': 'active'},
    )
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

        branch_uuid = p.get('branch_id')
        if not branch_uuid:
            print(f'  [경고] branch_id 없음 — 스킵: {short_code}')
            continue

        cfgs.append({
            'name':         short_code,
            'display_name': (p.get('display_name') or short_code).strip(),
            'email':        email,
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


# ════════════════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════════════════
def main():
    print(f'[Actions] PPTX 생성 시작 — {YEAR}년 {MONTH}월')

    print('[1/4] menu_data 조회...')
    raw_menu_data = fetch_menu_data()

    print('[2/4] branch_profiles 조회...')
    branch_cfgs = fetch_branch_cfgs()
    print(f'  → {len(branch_cfgs)}개 원 로드')

    print('[3/4] 메뉴 데이터 변환...')
    adapted_menu = _adapt_ts_menu_data(raw_menu_data)
    date_map     = _build_date_map(adapted_menu)

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
                    gen_pptx(cfg, adapted_menu, TEMPLATE_PATH, out_pptx, date_map=date_map)
                    pptx_url = upload_pptx(out_pptx, storage_path)
                    upsert_branch_row(branch_uuid, 'generated', pptx_url)
                    print(f'  ✅ {short_code}')
                    succeeded += 1
                except Exception as exc:
                    print(f'  ❌ {short_code}: {exc}')
                    upsert_branch_row(branch_uuid, 'error', '')
                    failed += 1
            gc.collect()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    print(f'\n[완료] 성공 {succeeded}개 / 실패 {failed}개 / 전체 {len(branch_cfgs)}개')

    # 공통 row 상태 업데이트
    final_status = 'generated' if succeeded > 0 else 'error'
    update_common_row_status(final_status)

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
