# -*- coding: utf-8 -*-
"""
업로드 파서 "주차 skip 판정" 회귀 테스트 — pytest 불필요, 직접 실행.
실행: python test_upload_week_skip.py

★이 파일은 app/api/diet-automation/upload/route.ts의 parseWeekSheet()가
쓰는 두 규칙을 파이썬으로 그대로 옮겨 테스트한다(TypeScript를 파이썬에서
직접 실행할 수 없어서다). ★TS 쪽 규칙을 고치면 아래 두 함수도 같이
고칠 것 — 안 그러면 이 테스트가 실제 코드와 다른 걸 검증하게 된다.★

  weekAllEmpty()   route.ts 131~140행과 동일 — 5칸(월~금) 전부 비었거나
                   '해당없음'일 때만 그 주차를 skip한다.
  parse_date_cell_ok()  route.ts parseDateCell()의 "유효한 날짜 칸인가"
                   판정만 옮김(날짜 문자열 변환 등 나머지는 이 테스트와
                   무관해 생략).
"""
import sys
import calendar


def week_all_empty(raw_dates):
    def norm(v):
        return str(v if v is not None else '').strip()
    return all((not norm(v)) or ('해당없음' in norm(v)) for v in raw_dates)


def parse_date_cell_ok(raw):
    s = str(raw if raw is not None else '').strip()
    if not s or '해당없음' in s:
        return None
    return s


def run_case(name, raw_dates, expect_skipped, expect_days):
    is_skipped = week_all_empty(raw_dates)
    days = [d for d in (parse_date_cell_ok(r) for r in raw_dates) if d is not None]
    ok = (is_skipped == expect_skipped) and (is_skipped or len(days) == expect_days)
    status = 'PASS' if ok else 'FAIL'
    print(f'[{status}] {name} — is_skipped={is_skipped}(기대 {expect_skipped}) '
          f'days={len(days)}개(기대 {expect_days if not expect_skipped else "-"})')
    return ok


def main():
    results = []

    # ── 지시된 3가지 기본 케이스 ──
    results.append(run_case(
        '5칸 전부 해당없음',
        ['해당없음', '해당없음', '해당없음', '해당없음', '해당없음'],
        expect_skipped=True, expect_days=0,
    ))
    results.append(run_case(
        '월만 해당없음, 화~금 날짜 있음',
        ['해당없음', '9/1', '9/2', '9/3', '9/4'],
        expect_skipped=False, expect_days=4,
    ))
    results.append(run_case(
        '목·금만 해당없음 (9월 5주차 케이스)',
        ['9/28', '9/29', '9/30', '해당없음', '해당없음'],
        expect_skipped=False, expect_days=3,
    ))

    # ── ★9월 하나로 끝내지 않기★ — 1일이 월~일 7가지 경우 전부 확인.
    #   1주차 날짜 행은 "1일이 속한 달력 주(월~금)"를 나타내므로, 1일의
    #   요일 앞쪽 칸들은 전달 몫이라 '해당없음'으로 채워진다(9월 실측과
    #   일치). calendar.monthrange의 요일(0=월…6=일)을 그대로 앞쪽 빈칸
    #   개수(offset)로 쓴다 — 토(5)·일(6)은 5칸을 넘으므로 5로 자른다
    #   (1주차 전체가 전달 몫 — 원래도 skip이 맞는 정상 케이스).
    months = [
        (2026, 6, '월'), (2026, 9, '화'), (2026, 4, '수'), (2026, 10, '목'),
        (2026, 5, '금'), (2026, 8, '토'), (2026, 11, '일'),
    ]
    for year, month, label in months:
        weekday, _ = calendar.monthrange(year, month)
        offset = min(weekday, 5)
        raw_dates = ['해당없음'] * offset + [f'{month}/{d}' for d in range(1, 5 - offset + 1)]
        name = f'{year}-{month:02d}(1일={label}) offset={offset}'
        if offset >= 5:
            results.append(run_case(name, raw_dates, expect_skipped=True, expect_days=0))
        else:
            results.append(run_case(name, raw_dates, expect_skipped=False, expect_days=5 - offset))

    print()
    if all(results):
        print(f'✅ 전체 통과 ({len(results)}건)')
        return 0
    else:
        print(f'❌ 실패 있음 ({sum(1 for r in results if not r)}/{len(results)}건)')
        return 1


if __name__ == '__main__':
    sys.exit(main())
