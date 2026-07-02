# -*- coding: utf-8 -*-
"""키즈밀 익월 빈 폼 생성기 — 달력엔진 기반, 서식보존(openpyxl)."""
import calendar, datetime, openpyxl, os

WD = ['월','화','수','목','금']

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

if __name__ == '__main__':
    import sys
    y, m = int(sys.argv[1]), int(sys.argv[2])
    HERE = os.path.dirname(os.path.abspath(__file__))
    base = os.path.join(HERE, '키즈밀_식단표_기준폼_v6.xlsx')
    out  = os.path.join(HERE, f'키즈밀_식단표_{y%100:02d}_{m:02d}_v6.xlsx')
    wks, mx = build_blank_form(base, out, y, m)
    print(f'생성: {os.path.basename(out)} ({mx}주)')
