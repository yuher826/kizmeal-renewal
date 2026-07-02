# -*- coding: utf-8 -*-
"""키즈밀 익월 빈 폼 생성기 — 달력엔진 기반, 서식보존(openpyxl)."""
import calendar, datetime, openpyxl, os

WD = ['월','화','수','목','금']

# xlsx MIME (Storage 업로드용)
XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

def compute_weeks(year, month):
    # 운영일(평일) 있는 첫 주 = 1주차. 평일별 그 주 월요일을 순서대로 번호.
    nd = calendar.monthrange(year, month)[1]
    monday_of, order = {}, []
    for day in range(1, nd+1):
        d = datetime.date(year, month, day)
        if d.weekday() >= 5: continue
        mon = d - datetime.timedelta(days=d.weekday())
        if mon not in monday_of:
            monday_of[mon] = len(order)+1; order.append(mon)
    weeks = {}
    for day in range(1, nd+1):
        d = datetime.date(year, month, day)
        if d.weekday() >= 5: continue
        mon = d - datetime.timedelta(days=d.weekday())
        weeks.setdefault(monday_of[mon], {})[2+d.weekday()] = day
    return weeks, (len(order) if order else 0)

def build_blank_form(base_path, out_path, year, month):
    weeks, max_wk = compute_weeks(year, month)
    if max_wk > 5:
        raise ValueError(f'{year}년 {month}월 운영주차 {max_wk}개 → 5주 초과')
    wb = openpyxl.load_workbook(base_path)   # 서식 보존
    for wk in range(1, 6):
        ws = wb[f'{wk}주차']
        ws['A1'] = f'{year}년 {month}월 식단표  [CK]  —  {wk}주차'
        slot = weeks.get(wk, {})
        for i in range(5):
            col = 2+i
            if wk > max_wk:
                ws.cell(3, col).value = '해당없음' if i == 0 else ''
            elif col in slot:
                ws.cell(3, col).value = f'{WD[i]}  {month}/{slot[col]}'
            else:
                ws.cell(3, col).value = ''
    wb.save(out_path)
    return weeks, max_wk

def storage_path_for(year, month):
    """빈 폼의 Storage 경로 규칙 (방법 B — DB 저장 없이 경로로 결정)."""
    fname = f'키즈밀_식단표_{year%100:02d}_{month:02d}_v6.xlsx'
    return f'{year}/{month:02d}/{fname}'

def upload_blank_form(local_path, year, month):
    """
    생성된 빈 폼을 Supabase Storage('diet-files')에 업로드.
    성공 시 public URL, 최종 실패 시 '' 반환. (upload_pptx 재시도 패턴 준용)
    환경변수 SUPABASE_URL, SUPABASE_SERVICE_KEY 필요 — 없으면 명확한 에러.
    """
    from supabase_uploader import SupabaseREST   # 지연 import (생성만 할 땐 불필요)

    url = os.getenv('SUPABASE_URL', '')
    key = os.getenv('SUPABASE_SERVICE_KEY', '')
    if not url or not key:
        raise RuntimeError(
            'Storage 업로드에는 환경변수 SUPABASE_URL, SUPABASE_SERVICE_KEY 가 필요합니다.'
        )

    bucket       = 'diet-files'
    storage_path = storage_path_for(year, month)
    client       = SupabaseREST(url, key)

    with open(local_path, 'rb') as f:
        data = f.read()

    for attempt in range(2):
        try:
            client.upload_file(bucket, storage_path, data, XLSX_MIME)
            return client.get_public_url(bucket, storage_path)
        except Exception as exc:
            if attempt == 0:
                print(f'  [업로드 재시도] {storage_path}: {exc}')
            else:
                print(f'  [업로드 실패] {storage_path}: {exc}')
                return ''
    return ''

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='키즈밀 익월 빈 폼 생성기')
    ap.add_argument('year',  type=int)
    ap.add_argument('month', type=int)
    ap.add_argument('--upload', action='store_true',
                    help='생성 후 Supabase Storage에 업로드')
    args = ap.parse_args()
    y, m = args.year, args.month

    HERE = os.path.dirname(os.path.abspath(__file__))
    base = os.path.join(HERE, '키즈밀_식단표_기준폼_v6.xlsx')
    out  = os.path.join(HERE, f'키즈밀_식단표_{y%100:02d}_{m:02d}_v6.xlsx')
    wks, mx = build_blank_form(base, out, y, m)
    print(f'생성: {os.path.basename(out)} ({mx}주)')

    if args.upload:
        public_url = upload_blank_form(out, y, m)
        if public_url:
            print(f'업로드: {public_url}')
        else:
            print('업로드 실패 (위 로그 확인)')
