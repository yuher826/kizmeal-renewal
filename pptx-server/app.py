# -*- coding: utf-8 -*-
"""
키즈밀 PPTX 생성 Flask API 서버
========================================================================

엔드포인트:
  GET  /health
  POST /generate   — multipart: excel_file, year, month, week_num(선택)
  GET  /status/<job_id>  — 향후 확장용

실행:
  gunicorn app:app --workers 1 --timeout 300 --bind 0.0.0.0:$PORT

⚠️ 일본어 금지.
"""

import gc
import os
import shutil
import threading
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(HERE, 'templates', '2026년 6월 식단표(양식).pptx')

app = Flask(__name__)

_ALLOWED_ORIGINS = [
    os.getenv('ALLOWED_ORIGIN', 'https://kizmeal-renewal.vercel.app'),
    'http://localhost:3000',
]
CORS(app, origins=_ALLOWED_ORIGINS)

_generate_lock = threading.Lock()


# ════════════════════════════════════════════════════════════════════
# 헬스체크
# ════════════════════════════════════════════════════════════════════
@app.get('/health')
def health():
    return jsonify({
        'status':  'ok',
        'service': 'kizmeal-pptx-server',
        'version': '1.0.0',
    })


# ════════════════════════════════════════════════════════════════════
# PPTX 일괄 생성
# ════════════════════════════════════════════════════════════════════
@app.post('/generate')
def generate():
    excel_file  = request.files.get('excel_file')
    year_str    = request.form.get('year')
    month_str   = request.form.get('month')
    week_num_str = request.form.get('week_num')

    if not excel_file:
        return jsonify({'error': 'excel_file 필드가 필요합니다.'}), 400
    if not year_str or not month_str:
        return jsonify({'error': 'year, month 필드가 필요합니다.'}), 400

    year     = int(year_str)
    month    = int(month_str)
    week_num = int(week_num_str) if week_num_str else None

    acquired = _generate_lock.acquire(blocking=False)
    if not acquired:
        return jsonify({
            'error': '이미 생성 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.'
        }), 429

    job_id  = str(uuid4())
    tmp_dir = f'/tmp/kizmeal_output/{job_id}'

    try:
        output_dir = os.path.join(tmp_dir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        excel_path = os.path.join(tmp_dir, 'input.xlsx')
        excel_file.save(excel_path)

        # 엑셀 파싱 + 개별 원 생성
        from read_excel import load_excel
        from pptx_generator import generate as gen_pptx

        menu_data, branches, date_map = load_excel(excel_path)

        raw_results = []
        for cfg in branches:
            branch_full_name = cfg['name']
            out_pptx = os.path.join(output_dir, f'{branch_full_name}_{year}{month:02d}.pptx')
            try:
                gen_pptx(cfg, menu_data, TEMPLATE_PATH, out_pptx, date_map=date_map)
                raw_results.append({
                    'branch_full_name': branch_full_name,
                    'pptx_path':   out_pptx,
                    'status':      'success',
                    'error_msg':   '',
                })
            except Exception as exc:
                raw_results.append({
                    'branch_full_name': branch_full_name,
                    'pptx_path':   None,
                    'status':      'error',
                    'error_msg':   str(exc),
                })

        # Supabase Storage 업로드
        import supabase_uploader
        upload_map = supabase_uploader.upload_all(output_dir, year, month, week_num)

        # DB 업데이트
        branch_id_map = _get_branch_id_map()
        _update_db(upload_map, branch_id_map, year, month, week_num)

        # 응답 조합
        results = []
        for r in raw_results:
            bn   = r['branch_full_name']
            urls = upload_map.get(bn, {})
            results.append({
                'branch_id':        branch_id_map.get(bn),
                'branch_name':      bn,
                'branch_full_name': bn,
                'pptx_url':         urls.get('pptx_url', ''),
                'pdf_url':          urls.get('pdf_url',  ''),
                'status':           r['status'],
                'error_msg':        r['error_msg'],
            })

        succeeded = sum(1 for r in results if r['status'] == 'success')
        failed    = len(results) - succeeded

        return jsonify({
            'success':   failed == 0,
            'job_id':    job_id,
            'total':     len(results),
            'succeeded': succeeded,
            'failed':    failed,
            'results':   results,
        })

    except Exception as exc:
        return jsonify({'error': f'생성 오류: {exc}', 'job_id': job_id}), 500

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        _generate_lock.release()


# ════════════════════════════════════════════════════════════════════
# 상태 조회 (향후 확장용)
# ════════════════════════════════════════════════════════════════════
@app.get('/status/<job_id>')
def status(job_id):
    return jsonify({'status': 'not_implemented'})


# ════════════════════════════════════════════════════════════════════
# 내부 유틸
# ════════════════════════════════════════════════════════════════════
def _get_branch_id_map():
    """branch_profiles.short_code → branch_id(uuid) 매핑 반환."""
    try:
        from supabase_uploader import get_supabase_client
        client = get_supabase_client()
        rows = client.select('branch_profiles', 'id,short_code')
        return {
            row['short_code']: row['id']
            for row in rows
            if row.get('short_code')
        }
    except Exception as exc:
        print(f'[branch_id 조회 오류] {exc}')
        return {}


def _update_db(upload_map, branch_id_map, year, month, week_num):
    """
    weekly_menus 테이블에 pptx_url / pdf_url 업서트.
    branch_id_map: {branch_full_name: branch_id(uuid)}
    """
    try:
        from supabase_uploader import get_supabase_client
        client = get_supabase_client()
    except Exception as exc:
        print(f'[DB 업데이트 스킵] Supabase 클라이언트 오류: {exc}')
        return

    for branch_full_name, urls in upload_map.items():
        branch_id = branch_id_map.get(branch_full_name)
        if not branch_id:
            continue

        pptx_url = urls.get('pptx_url') or None
        pdf_url  = urls.get('pdf_url')  or None

        try:
            if week_num is not None:
                client.upsert(
                    'weekly_menus',
                    {
                        'branch_id': branch_id,
                        'year':      year,
                        'month':     month,
                        'week_num':  week_num,
                        'pptx_url':  pptx_url,
                        'pdf_url':   pdf_url,
                    },
                    on_conflict='branch_id,year,month,week_num',
                )
            else:
                # week_num IS NULL: PostgreSQL unique 제약에서 NULL ≠ NULL이므로 직접 처리
                existing = client.select(
                    'weekly_menus', 'id',
                    filters={
                        'branch_id': branch_id,
                        'year':      year,
                        'month':     month,
                        'week_num':  None,
                    },
                )
                if existing:
                    client.update(
                        'weekly_menus',
                        {'pptx_url': pptx_url, 'pdf_url': pdf_url},
                        filters={'id': existing[0]['id']},
                    )
                else:
                    client.insert('weekly_menus', {
                        'branch_id': branch_id,
                        'year':      year,
                        'month':     month,
                        'week_num':  None,
                        'pptx_url':  pptx_url,
                        'pdf_url':   pdf_url,
                    })
        except Exception as exc:
            print(f'[DB 업데이트 오류] {branch_full_name}: {exc}')


# ════════════════════════════════════════════════════════════════════
# /generate-from-json 전용 어댑터 & 헬퍼
# ════════════════════════════════════════════════════════════════════
def _adapt_ts_day(ts_day):
    """
    TypeScript ExcelDayData → Python parse_week() day_dict 변환.

    TypeScript는 special/exception을 원본 그대로 저장하므로
    Python의 _embed_brackets / _inject_exception_to_banchan 처리가 필요함.
    """
    from datetime import date as _date_cls
    from read_excel import _embed_brackets, _inject_exception_to_banchan
    from bracket_parser import wants_fruit

    lunch_raw  = ts_day.get('lunch', {})
    am_raw     = ts_day.get('morning_snack', {})
    pm_raw     = ts_day.get('afternoon_snack', {})
    care_raw   = ts_day.get('care_snack', {})

    lunch_spec = lunch_raw.get('special', '')
    lunch_exc  = lunch_raw.get('exception', '')

    # 반찬 예외규칙 인라인 삽입
    banchans = {
        'banchan1': lunch_raw.get('banchan1', ''),
        'banchan2': lunch_raw.get('banchan2', ''),
        'banchan3': lunch_raw.get('banchan3', ''),
        'banchan4': lunch_raw.get('banchan4', ''),
        'banchan5': lunch_raw.get('banchan5', ''),
    }
    if lunch_exc:
        _inject_exception_to_banchan(banchans, lunch_exc)

    # 오전간식 브래킷 임베딩
    am_menu = _embed_brackets(
        am_raw.get('menu', ''),
        am_raw.get('special', ''),
        am_raw.get('exception', ''),
    )

    # 오후간식 브래킷 임베딩 (중식 원별특이사항 비-과일 브래킷 포함)
    pm_menu = _embed_brackets(
        pm_raw.get('menu', ''),
        pm_raw.get('special', ''),
        pm_raw.get('exception', ''),
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
    """
    TypeScript ParsedWeek → Python parse_week() 형식.

    TypeScript days는 실제 날짜만 포함(스킵된 날 없음).
    Python은 5슬롯 배열(월=0…금=4)을 기대하므로
    ISO 날짜에서 요일을 계산해 올바른 슬롯에 배치.
    """
    from datetime import date as _date_cls

    if not ts_week or ts_week.get('is_skipped'):
        return None

    ordered = [None] * 5  # 월(0)~금(4)
    for raw_day in ts_week.get('days', []):
        date_str = raw_day.get('date', '')
        try:
            d = _date_cls.fromisoformat(date_str)
            wd = d.weekday()  # 0=월, 4=금
            if 0 <= wd <= 4:
                ordered[wd] = _adapt_ts_day(raw_day)
        except (ValueError, AttributeError):
            pass

    return {'wk': ts_week.get('week_num'), 'days': ordered}


def _adapt_ts_menu_data(raw_menu_data):
    """
    weekly_menus.menu_data (TypeScript 파서 출력) →
    pptx_generator._days_by_week() 호환 형식.
    """
    raw_weeks = raw_menu_data.get('weeks', {})
    adapted_weeks = {}
    for key, ts_week in raw_weeks.items():
        adapted = _adapt_ts_week(ts_week)
        if adapted is not None:
            adapted_weeks[str(key)] = adapted
        # is_skipped 주차는 키 자체를 제외 → _days_by_week에서 [None]*5 처리

    return {
        'year':  raw_menu_data.get('year'),
        'month': raw_menu_data.get('month'),
        'weeks': adapted_weeks,
    }


def _build_date_map_from_adapted(adapted_menu_data):
    """
    어댑팅된 menu_data에서 날짜 그룹 대체용 date_map 생성.
    슬롯 '09','10','16','17' → 2주화/수, 3주화/수 실제 일자.
    """
    weeks = adapted_menu_data.get('weeks', {})

    def _day_num(wk_str, slot_idx):
        wdata = weeks.get(wk_str)
        if not wdata:
            return ''
        days = wdata.get('days', [])
        if slot_idx < len(days) and days[slot_idx]:
            date_str = days[slot_idx].get('date', '')
            # ISO "2026-06-09" → "09" / 또는 이미 "09" 형식
            if len(date_str) == 10:
                return date_str.split('-')[2]
            return date_str
        return ''

    return {
        '09': _day_num('2', 1),  # 2주 화
        '10': _day_num('2', 2),  # 2주 수
        '16': _day_num('3', 1),  # 3주 화
        '17': _day_num('3', 2),  # 3주 수
    }


def _get_branch_cfgs_from_db():
    """
    branch_profiles 테이블에서 활성 원 설정을 읽어
    pptx_generator.generate()에 전달할 cfg 리스트 반환.
    """
    from read_excel import determine_type
    try:
        from supabase_uploader import get_supabase_client
        client = get_supabase_client()
        profiles = client.select(
            'branch_profiles',
            'short_code,display_name,distribution_email,distribution_emails,'
            'slide_count,snack_morning,snack_afternoon,snack_childcare,'
            'needs_english,has_yonder,has_dessert_fruit,file_format,'
            'snack_label,morning_snack_fixed,morning_snack_fixed_menu',
            filters={'contract_status': 'active'},
        )
    except Exception as exc:
        print(f'[branch_profiles 조회 오류] {exc}')
        return []

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

        # snack_label: DB 기본값 '오전간식/오후간식' → '오전'. 정확히 '간식'이면 '간식'
        raw_lbl    = (p.get('snack_label') or '').strip()
        snack_lbl  = '간식' if raw_lbl == '간식' else '오전'

        # 배포 이메일
        email = (p.get('distribution_email') or '').strip()
        if not email:
            emails = p.get('distribution_emails') or []
            email  = emails[0] if emails else ''

        # 고정 오전간식
        fixed_am = None
        if p.get('morning_snack_fixed') and p.get('morning_snack_fixed_menu'):
            fixed_am = {'menu': p['morning_snack_fixed_menu'], 'nutrition': ''}

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
        })

    return cfgs


# ════════════════════════════════════════════════════════════════════
# POST /generate-from-json
# ════════════════════════════════════════════════════════════════════
@app.post('/generate-from-json')
def generate_from_json():
    """
    weekly_menus.menu_data JSONB를 직접 받아 PPTX 생성.
    엑셀 파일 업로드 없이 DB 데이터만으로 생성 가능.

    request body (JSON):
      { "menu_data": {...}, "year": 2026, "month": 6, "week_num": 1 }
    """
    body = request.get_json(silent=True) or {}

    raw_menu_data = body.get('menu_data')
    year_val      = body.get('year')
    month_val     = body.get('month')
    week_num_val  = body.get('week_num')

    if not raw_menu_data:
        return jsonify({'error': 'menu_data 필드가 필요합니다.'}), 400
    if not year_val or not month_val:
        return jsonify({'error': 'year, month 필드가 필요합니다.'}), 400

    year     = int(year_val)
    month    = int(month_val)
    week_num = int(week_num_val) if week_num_val is not None else None

    # 요청한 주차 데이터 존재 확인
    if week_num is not None:
        raw_weeks = raw_menu_data.get('weeks', {})
        if str(week_num) not in raw_weeks and week_num not in raw_weeks:
            return jsonify({'error': f'menu_data에 {week_num}주차 데이터가 없습니다.'}), 400

    acquired = _generate_lock.acquire(blocking=False)
    if not acquired:
        return jsonify({
            'error': '이미 생성 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.'
        }), 429

    job_id  = str(uuid4())
    tmp_dir = f'/tmp/kizmeal_output/{job_id}'

    try:
        output_dir = os.path.join(tmp_dir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        # TypeScript 포맷 → Python 포맷 변환
        adapted_menu = _adapt_ts_menu_data(raw_menu_data)
        date_map     = _build_date_map_from_adapted(adapted_menu)

        # branch_profiles에서 원 설정 로드
        branch_cfgs = _get_branch_cfgs_from_db()
        if not branch_cfgs:
            return jsonify({'error': 'branch_profiles에서 활성 원 설정을 불러오지 못했습니다.'}), 500

        from pptx_generator import generate as gen_pptx

        _BATCH = 5
        raw_results = []
        for batch_start in range(0, len(branch_cfgs), _BATCH):
            for cfg in branch_cfgs[batch_start:batch_start + _BATCH]:
                branch_full_name = cfg['name']
                out_pptx = os.path.join(output_dir, f'{branch_full_name}_{year}{month:02d}.pptx')
                try:
                    gen_pptx(cfg, adapted_menu, TEMPLATE_PATH, out_pptx, date_map=date_map)
                    raw_results.append({
                        'branch_full_name': branch_full_name,
                        'pptx_path':   out_pptx,
                        'status':      'success',
                        'error_msg':   '',
                    })
                except Exception as exc:
                    raw_results.append({
                        'branch_full_name': branch_full_name,
                        'pptx_path':   None,
                        'status':      'error',
                        'error_msg':   str(exc),
                    })
            gc.collect()

        # Supabase Storage 업로드
        import supabase_uploader
        upload_map = supabase_uploader.upload_all(output_dir, year, month, week_num)

        # DB 업데이트
        branch_id_map = _get_branch_id_map()
        _update_db(upload_map, branch_id_map, year, month, week_num)

        # 응답 조합
        results = []
        for r in raw_results:
            bn   = r['branch_full_name']
            urls = upload_map.get(bn, {})
            results.append({
                'branch_id':        branch_id_map.get(bn),
                'branch_name':      bn,
                'branch_full_name': bn,
                'pptx_url':         urls.get('pptx_url', ''),
                'pdf_url':          urls.get('pdf_url',  ''),
                'status':           r['status'],
                'error_msg':        r['error_msg'],
            })

        succeeded = sum(1 for r in results if r['status'] == 'success')
        failed    = len(results) - succeeded

        return jsonify({
            'success':   failed == 0,
            'job_id':    job_id,
            'total':     len(results),
            'succeeded': succeeded,
            'failed':    failed,
            'results':   results,
        })

    except Exception as exc:
        return jsonify({'error': f'생성 오류: {exc}', 'job_id': job_id}), 500

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        _generate_lock.release()


if __name__ == '__main__':
    app.run(debug=True, port=5000)
