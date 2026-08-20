# -*- coding: utf-8 -*-
"""키즈밀 익월 빈 폼 생성기 — 달력엔진 기반, 서식보존(openpyxl).

■ 기준폼과 서식 리셋
기준폼(키즈밀_식단표_기준폼_v6.xlsx)은 2026년 6월 실데이터에서 파생됐다.
그래서 6월에만 해당하는 서식이 파일에 눌어붙어 있고, 날짜 텍스트만 바꾸면
다른 달에도 그대로 따라온다. 대표적으로 셋:
  (a) 1주차 D열 = 6/3 지방선거일 공휴일 회색(FFB0BEC5)
  (b) 1·2·3주차 F열 헤더 🎂 + 18행 생일간식 주황(FFFFE0B2)
  (c) 5주차 D·E·F열 = 6월에 없는 날 회색(FFEEEEEE)
따라서 이 모듈은 각 주차 시트의 B~F열(3~24행)을 대상 월 상태에 맞는
서식 템플릿으로 **통째 덮어쓴다**. 6월 잔재는 덮어쓰기로 자동 소멸한다.

■ 공휴일은 코드가 판정하지 않는다
공휴일에 운영하는 원과 쉬는 원이 갈린다. 코드가 달력만 보고 일괄로
공휴일을 칠하면 그 차이를 뭉갠다. 그래서 기본 동작에서 열 상태는 둘뿐이다:
  · 운영일        — 그 달에 존재하는 평일
  · 해당없음      — 그 달에 없는 날(주 앞뒤가 잘린 칸, 미사용 주차)
공휴일 표시는 사람이 판단한 결과가 진실 기준이다. 다만 공휴일 열은 행마다
상태가 달라(아래 참조) 손으로 재현하기 어려우므로, **사람이 이미 정해둔
경우에 한해** 서식만 대신 입혀준다. 코드가 스스로 날짜를 찾아내는 일은 없다.

그 "사람이 정해둔 것"의 입력 경로가 둘이다:
  1) public_holidays 테이블 (기본) — ERP 팝업에서 영양기획팀이 확인·분류한
     결과. closure_policy='all_closed'인 날만 공휴일 서식을 입힌다.
     'all_operating'(노동절·제헌절 등 원이 정상운영하는 날)은 운영일로 둔다.
     ⚠️ 미분류(NULL)는 **적용하지 않고 경고만** 낸다 — 코드가 어느 쪽으로든
        추측하면 위 원칙이 깨진다. 팝업에서 분류하고 다시 생성하면 된다.
  2) --holiday 일:사유 (수동) — DB 값 위에 덮어쓴다. 긴급 상황과 로컬
     테스트용. DB를 못 읽어도(환경변수 없음/장애) 이 경로는 살아 있다.

이 구조 덕분에 특일 정보 API 인증키를 Actions에 둘 필요가 없다. API 호출과
팝업은 Next.js(ERP)가 맡고, 여기서는 사람 확인을 거친 결과만 읽는다.

■ 서식 템플릿 표본 (모두 기준폼 6월 데이터에서 캡처)
  · 운영일   = 각 주차 시트의 B열(월요일). 6월은 모든 월요일이 정상
               운영일이라 주차별 테마색이 그대로 살아있는 깨끗한 표본.
               (1주차 FF2E7D32/FFF1F8E9, 2주차 FF1565C0/FFE8F2FD,
                3주차 FF6A1B9A/FFF5F0FC, 4주차 FFE65100/FFFFF8E7,
                5주차 FF00695C/FFE0F7FA)
  · 해당없음 = 5주차 시트 D열. 6월 5주차 수·목·금이 정확히 이 상태.
               회색은 주차 테마와 무관하므로 전 주차 공용.
  · 공휴일   = 1주차 시트 D열(6/3 선거일). 이 열은 행마다 상태가 다르다.
               4~11·15·20·24행은 회색 '—'로 닫혀 있지만, 12·13행
               (원별특이사항·예외규칙)과 14·16·17·19·21·22행(간식 계열)은
               평상시 서식 그대로 열려 있다. 공휴일에도 운영하는 원이 있어
               그 칸은 살려두는 실무 구조다. 23행(돌봄간식)은 배경은
               평상시인데 값만 '—'. 열 통째 캡처라 이 행별 차이가 그대로 보존된다.

■ 생일주(🎂)
운영일 템플릿의 18행 상태(회색 '—')를 그대로 적용해 중립으로 리셋하며,
헤더에 🎂를 넣지 않는다. 생일간식 칸의 실제 입력 여부가 진실 기준이고,
이모지는 SheetJS 파싱에서 깨질 수 있어 신뢰하지 않는다.

■ 헤더 텍스트 형식 (건드리지 말 것)
app/api/diet-automation/upload/route.ts 의 parseDateCell/parseWeekSheet 가
이 형식을 파싱한다. '{요일}  {월}/{일}'(공백 2칸) / '해당없음' / '공휴일'.
"""
import argparse, calendar, copy, datetime, openpyxl, os

WD = ['월','화','수','목','금']

# xlsx MIME (Storage 업로드용)
XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

# 서식을 덮어쓸 범위 — 3행=날짜 헤더, 4~24행=데이터.
# 1·2행(제목·안내)과 25·26행(범례), A열(구분 라벨), 병합셀은 건드리지 않는다.
ROW_START, ROW_END = 3, 24
COL_START, COL_END = 2, 6          # B~F열 = 월~금

# 서식 템플릿 표본 위치 (모듈 docstring 참조)
TPL_OPERATING_COL   = 2            # 각 주차 시트의 B열(월요일)
TPL_NONE_SHEET      = '5주차'
TPL_NONE_COL        = 4            # 5주차 D열 = 해당없음
TPL_HOLIDAY_SHEET   = '1주차'
TPL_HOLIDAY_COL     = 4            # 1주차 D열 = 6/3 선거일


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


def _capture_column(ws, col):
    """지정 열의 ROW_START~ROW_END 서식·값을 복제해 템플릿 dict로 반환.

    ⚠️ openpyxl의 cell.fill/font/border/alignment 는 StyleProxy라서 다른 셀에
    그대로 대입하면 원본과 묶여버린다. 항목별로 copy.copy 해야 독립 사본이 된다.
    value도 함께 캡처한다 — 10행 '없으면 빈칸', 18행 '—' 같은 안내 문구가
    템플릿의 일부이기 때문.
    """
    tpl = {}
    for row in range(ROW_START, ROW_END+1):
        c = ws.cell(row, col)
        tpl[row] = {
            'fill':          copy.copy(c.fill),
            'font':          copy.copy(c.font),
            'border':        copy.copy(c.border),
            'alignment':     copy.copy(c.alignment),
            'number_format': c.number_format,
            'value':         c.value,
        }
    return tpl


def _apply_column(ws, col, tpl, header):
    """캡처한 템플릿을 지정 열에 적용. 3행 값만 header로 새로 쓴다.

    3행의 서식(배경색)은 템플릿 것을 그대로 쓰고 텍스트만 대상 월 값으로
    교체한다 — 공휴일 템플릿의 '수  6/3\\n공휴일\\n(선거일)'처럼 6월 고유
    텍스트가 따라오면 안 되기 때문.
    """
    for row, style in tpl.items():
        c = ws.cell(row, col)
        c.fill          = copy.copy(style['fill'])
        c.font          = copy.copy(style['font'])
        c.border        = copy.copy(style['border'])
        c.alignment     = copy.copy(style['alignment'])
        c.number_format = style['number_format']
        c.value         = header if row == ROW_START else style['value']


def _operating_header(month, day, weekday_idx):
    """운영일 헤더. route.ts parseDateCell 가 읽는 형식 — 공백 2칸 고정."""
    return f'{WD[weekday_idx]}  {month}/{day}'


def _holiday_header(month, day, weekday_idx, reason):
    """공휴일 헤더. 기준폼 6월 원본과 동일한 3줄 형식."""
    head = _operating_header(month, day, weekday_idx)
    return f'{head}\n공휴일\n({reason})' if reason else f'{head}\n공휴일'


def parse_holiday_args(items):
    """--holiday '17:제헌절' 목록 → {17: '제헌절'}."""
    result = {}
    for raw in items or []:
        if ':' not in raw:
            raise ValueError(f'--holiday 형식 오류: {raw!r} — 예: 17:제헌절')
        day_str, reason = raw.split(':', 1)
        try:
            day = int(day_str.strip())
        except ValueError:
            raise ValueError(f'--holiday 날짜가 숫자가 아닙니다: {raw!r} — 예: 17:제헌절')
        result[day] = reason.strip()
    return result


def fetch_holiday_map(year, month):
    """public_holidays에서 그 달의 공휴일을 읽는다.

    반환: (holiday_map, unclassified, operating)
      holiday_map  {일(int): 사유(str)}  — closure_policy='all_closed'. 서식 적용 대상
      unclassified [(일, 이름), …]        — closure_policy IS NULL. 적용하지 않고 경고
      operating    [(일, 이름), …]        — 'all_operating'. 운영일로 두었음을 알리는 용도

    DB를 못 읽는 상황(환경변수 없음, 네트워크 장애)에서는 폼 생성 자체를
    막지 않고 빈 결과 + 경고로 넘어간다. --holiday 수동 경로가 살아 있고,
    영양사가 생성된 파일 헤더에 직접 입력하는 길도 남아 있기 때문.
    """
    url = os.getenv('SUPABASE_URL', '')
    key = os.getenv('SUPABASE_SERVICE_KEY', '')
    if not url or not key:
        print('  [공휴일] SUPABASE_URL/SUPABASE_SERVICE_KEY 없음 → DB 조회 생략')
        return {}, [], []

    try:
        from supabase_uploader import SupabaseREST   # 지연 import
        client = SupabaseREST(url, key)
        # SupabaseREST.select는 등가 필터만 지원하므로(gte/lte 없음) 전량 조회 후
        # 파이썬에서 거른다. public_holidays는 연 20여 행짜리 표라 부담이 없고,
        # PPTX 파이프라인 전체가 쓰는 공용 모듈을 건드리지 않아도 된다.
        rows = client.select('public_holidays', 'holiday_date,name,closure_policy')
    except Exception as exc:
        print(f'  [공휴일] DB 조회 실패 → 공휴일 없이 진행합니다: {exc}')
        return {}, [], []

    prefix = f'{year}-{month:02d}-'
    holiday_map, unclassified, operating = {}, [], []
    weekend = []
    for r in rows or []:
        date_str = str(r.get('holiday_date') or '')
        if not date_str.startswith(prefix):
            continue
        try:
            day = int(date_str[8:10])
        except ValueError:
            continue
        name   = (r.get('name') or '공휴일').strip()
        policy = r.get('closure_policy')

        # ★주말 공휴일은 폼에 칸 자체가 없다(B~F열 = 월~금).
        #   그냥 넘기지 않고 걸러야 한다 — build_blank_form이 "평일이 아닌
        #   날짜를 공휴일로 지정했습니다"로 예외를 던져 생성이 통째로 죽는다.
        #   예: 2026년 광복절 8/15는 토요일(그래서 8/17 대체공휴일이 생겼다).
        if datetime.date(year, month, day).weekday() >= 5:
            weekend.append((day, name))
            continue

        if policy == 'all_closed':
            holiday_map[day] = name
        elif policy == 'all_operating':
            operating.append((day, name))
        else:
            unclassified.append((day, name))

    if weekend:
        days = ', '.join(f'{month}/{d} {n}' for d, n in sorted(weekend))
        print(f'  [공휴일] 주말이라 폼에 칸이 없어 건너뜀: {days}')

    return holiday_map, sorted(unclassified), sorted(operating)


def build_blank_form(base_path, out_path, year, month, holiday_map=None):
    """대상 월의 빈 폼을 생성한다.

    holiday_map: {일(int): 사유(str)}. 사람이 명시적으로 지정한 공휴일만 받는다.
                 코드가 달력에서 공휴일을 찾아내는 일은 없다 — 공휴일 운영
                 여부가 원마다 다르기 때문. 비워두면 모든 평일이 운영일로
                 생성되고, 공휴일 표시는 영양사가 헤더에 직접 입력한다.
    """
    weeks, max_wk = compute_weeks(year, month)
    if max_wk > 5:
        raise ValueError(f'{year}년 {month}월 운영주차 {max_wk}개 → 5주 초과')

    holiday_map = holiday_map or {}
    # 오타로 지정이 조용히 무시되는 것을 막는다.
    valid_days = {d for slot in weeks.values() for d in slot.values()}
    unknown = sorted(set(holiday_map) - valid_days)
    if unknown:
        raise ValueError(
            f'{year}년 {month}월의 평일이 아닌 날짜를 공휴일로 지정했습니다: {unknown}'
        )

    wb = openpyxl.load_workbook(base_path)   # 서식 보존

    # ── 1) 서식 템플릿 캡처 — 어떤 셀도 수정하기 전에 먼저 ────────────
    tpl_operating = {wk: _capture_column(wb[f'{wk}주차'], TPL_OPERATING_COL)
                     for wk in range(1, 6)}
    tpl_none    = _capture_column(wb[TPL_NONE_SHEET],    TPL_NONE_COL)
    tpl_holiday = _capture_column(wb[TPL_HOLIDAY_SHEET], TPL_HOLIDAY_COL)

    # ── 2) 열 단위 적용 ───────────────────────────────────────────────
    counts = {'운영일': 0, '해당없음': 0, '공휴일': 0}
    for wk in range(1, 6):
        ws = wb[f'{wk}주차']
        ws['A1'] = f'{year}년 {month}월 식단표  [CK]  —  {wk}주차'
        slot = weeks.get(wk, {})
        for i in range(5):
            col = COL_START + i
            # 그 달에 없는 날 + 아예 쓰이지 않는 주차 → 해당없음
            if wk > max_wk or col not in slot:
                _apply_column(ws, col, tpl_none, '해당없음')
                counts['해당없음'] += 1
                continue
            day = slot[col]
            if day in holiday_map:
                _apply_column(ws, col, tpl_holiday,
                              _holiday_header(month, day, i, holiday_map[day]))
                counts['공휴일'] += 1
            else:
                _apply_column(ws, col, tpl_operating[wk],
                              _operating_header(month, day, i))
                counts['운영일'] += 1

    wb.save(out_path)
    return weeks, max_wk, counts


def storage_path_for(year, month):
    """빈 폼의 Storage 경로 규칙 (방법 B — DB 저장 없이 경로로 결정).

    ⚠️ 여기 파일명은 'Storage key 전용'이며 반드시 순수 ASCII.
    (한글 key는 Supabase/S3에서 400 InvalidKey). 사용자 다운로드 시
    한글 표시명은 다운로드 API의 Content-Disposition에서 별도 지정(조각6).
    """
    fname = f'blank_form_{year%100:02d}_{month:02d}_v6.xlsx'
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
    import sys
    ap = argparse.ArgumentParser(description='키즈밀 익월 빈 폼 생성기')
    ap.add_argument('year',  type=int)
    ap.add_argument('month', type=int)
    ap.add_argument('--upload', action='store_true',
                    help='생성 후 Supabase Storage에 업로드')
    ap.add_argument('--holiday', action='append', metavar='일:사유',
                    help='공휴일을 직접 지정 (예: --holiday 17:제헌절). '
                         '여러 번 쓸 수 있음. DB(public_holidays) 값 위에 덮어쓴다.')
    ap.add_argument('--no-db-holiday', action='store_true',
                    help='public_holidays 조회를 생략 (로컬 테스트·오프라인용)')
    args = ap.parse_args()
    y, m = args.year, args.month

    try:
        cli_holidays = parse_holiday_args(args.holiday)
    except ValueError as exc:
        print(f'오류: {exc}')
        sys.exit(1)

    # ── 공휴일 결정: DB(사람이 팝업에서 분류한 결과) + --holiday 덮어쓰기 ──
    if args.no_db_holiday:
        print('  [공휴일] --no-db-holiday → DB 조회 생략')
        db_holidays, unclassified, operating = {}, [], []
    else:
        db_holidays, unclassified, operating = fetch_holiday_map(y, m)

    holiday_map = dict(db_holidays)
    holiday_map.update(cli_holidays)      # 수동 지정이 우선

    if operating:
        days = ', '.join(f'{m}/{d} {n}' for d, n in operating)
        print(f'  [공휴일] 전 원 정상운영으로 분류되어 운영일로 둠: {days}')
    if unclassified:
        days = ', '.join(f'{m}/{d} {n}' for d, n in unclassified)
        print(f'  ⚠️ [공휴일] 미분류라 서식을 적용하지 않았습니다: {days}')
        print('     ERP 공휴일 설정에서 분류한 뒤 다시 생성하세요.')
    overridden = sorted(set(cli_holidays) & set(db_holidays))
    if overridden:
        print(f'  [공휴일] --holiday 가 DB 값을 덮어썼습니다: {overridden}')

    HERE = os.path.dirname(os.path.abspath(__file__))
    base = os.path.join(HERE, '키즈밀_식단표_기준폼_v6.xlsx')
    # 로컬 생성 파일명은 한글 유지(영양사 친화). Storage key는 storage_path_for()에서 영문.
    out  = os.path.join(HERE, f'키즈밀_식단표_{y%100:02d}_{m:02d}_v6.xlsx')

    try:
        wks, mx, counts = build_blank_form(base, out, y, m, holiday_map)
    except ValueError as exc:
        print(f'오류: {exc}')
        sys.exit(1)

    print(f'생성: {os.path.basename(out)} ({mx}주)')
    print(f'  운영일 {counts["운영일"]}칸 / 공휴일 {counts["공휴일"]}칸 '
          f'/ 해당없음 {counts["해당없음"]}칸')
    if not holiday_map:
        print('  ※ 공휴일 서식이 적용된 칸이 없습니다. 코드는 공휴일을 스스로')
        print('     판정하지 않습니다 — 원마다 운영 여부가 달라서입니다.')
        print('     ERP 공휴일 설정에서 분류하거나, --holiday 로 지정하거나,')
        print("     생성된 파일 3행 헤더에 '공휴일(사유)'를 직접 입력하세요.")

    if args.upload:
        public_url = upload_blank_form(out, y, m)
        if public_url:
            print(f'업로드: {public_url}')
        else:
            print('업로드 실패 (위 로그 확인)')
            sys.exit(1)   # 단일 파일 → 실패=전량실패, Actions 빨간불
