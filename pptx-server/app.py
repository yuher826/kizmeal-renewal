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
            branch_name = cfg['name']
            out_pptx = os.path.join(output_dir, f'{branch_name}_{year}{month:02d}.pptx')
            try:
                gen_pptx(cfg, menu_data, TEMPLATE_PATH, out_pptx, date_map=date_map)
                raw_results.append({
                    'branch_name': branch_name,
                    'pptx_path':   out_pptx,
                    'status':      'success',
                    'error_msg':   '',
                })
            except Exception as exc:
                raw_results.append({
                    'branch_name': branch_name,
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
            bn   = r['branch_name']
            urls = upload_map.get(bn, {})
            results.append({
                'branch_id':   branch_id_map.get(bn),
                'branch_name': bn,
                'pptx_url':    urls.get('pptx_url', ''),
                'pdf_url':     urls.get('pdf_url',  ''),
                'status':      r['status'],
                'error_msg':   r['error_msg'],
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
        res = client.table('branch_profiles').select('branch_id, short_code').execute()
        return {
            row['short_code']: row['branch_id']
            for row in (res.data or [])
            if row.get('short_code')
        }
    except Exception as exc:
        print(f'[branch_id 조회 오류] {exc}')
        return {}


def _update_db(upload_map, branch_id_map, year, month, week_num):
    """
    weekly_menus 테이블에 pptx_url / pdf_url 업서트.
    branch_id_map: {branch_name: branch_id(uuid)}
    """
    try:
        from supabase_uploader import get_supabase_client
        client = get_supabase_client()
    except Exception as exc:
        print(f'[DB 업데이트 스킵] Supabase 클라이언트 오류: {exc}')
        return

    for branch_name, urls in upload_map.items():
        branch_id = branch_id_map.get(branch_name)
        if not branch_id:
            continue

        pptx_url = urls.get('pptx_url') or None
        pdf_url  = urls.get('pdf_url')  or None

        try:
            if week_num is not None:
                client.table('weekly_menus').upsert(
                    {
                        'branch_id': branch_id,
                        'year':      year,
                        'month':     month,
                        'week_num':  week_num,
                        'pptx_url':  pptx_url,
                        'pdf_url':   pdf_url,
                    },
                    on_conflict='branch_id,year,month,week_num',
                ).execute()
            else:
                # week_num IS NULL: PostgreSQL unique 제약에서 NULL ≠ NULL이므로 직접 처리
                existing = (
                    client.table('weekly_menus')
                    .select('id')
                    .eq('branch_id', branch_id)
                    .eq('year', year)
                    .eq('month', month)
                    .is_('week_num', 'null')
                    .execute()
                )
                if existing.data:
                    client.table('weekly_menus').update({
                        'pptx_url': pptx_url,
                        'pdf_url':  pdf_url,
                    }).eq('id', existing.data[0]['id']).execute()
                else:
                    client.table('weekly_menus').insert({
                        'branch_id': branch_id,
                        'year':      year,
                        'month':     month,
                        'week_num':  None,
                        'pptx_url':  pptx_url,
                        'pdf_url':   pdf_url,
                    }).execute()
        except Exception as exc:
            print(f'[DB 업데이트 오류] {branch_name}: {exc}')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
