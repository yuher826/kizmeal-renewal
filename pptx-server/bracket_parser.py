# -*- coding: utf-8 -*-
"""
원별 참조표 대괄호(원별 오버라이드) 파서
========================================================================

CK 공통 식단 1벌을 원(branch)별 식단으로 분기시키는 핵심 모듈.
메뉴 값(셀 텍스트) 안에 인라인으로 붙는 대괄호 표기를 해석한다.

표기 규칙(합의)
------------------------------------------------------------------------
  기본메뉴[원명-대체메뉴]   → 해당 원은 '대체메뉴' 로 교체
  기본메뉴[원명-메뉴명X]    → 해당 원은 이 항목 제거 (대시 뒤가 X로 끝남)
  기본메뉴[원명X]           → 해당 원은 이 항목 제거 (대시 없음)
  [후식과일]                → 후식과일 추가 플래그(메뉴 교체 아님, 별도 처리)
  [원명1,원명2-대체]        → 복수 원 쉼표 분리, 모두 동일 적용
  [P-대체] 등 브랜드코드     → 해당 브랜드 전체 원으로 확장 (동탄P 제외)

매칭되지 않는 원은 대괄호 부분이 전부 제거된 '기본메뉴' 를 그대로 사용한다.
제거(remove) 규칙이 매칭되면 빈 문자열('')을 반환 → 호출측에서 항목 드롭.

⚠️ 일본어 금지. 모든 주석/문자열 한국어.
"""

import re

# ── 브랜드코드 확장표 (동탄P 는 의도적으로 제외: 별도 고정 규칙 보유) ──────
BRAND_EXPAND = {
    "P": [
        "일산P", "정발P", "송도P", "송파P", "분당P", "수지P", "수지P별관",
        "영통P", "중계P", "목동P", "광명P", "덕양P", "위례P", "하남P",
        "광교P", "대치P", "운정P", "강동P",
    ],
    "E": ["목동E", "노원E", "쌍문E", "성북E", "송파E", "강동E"],
    "R": ["분당R", "서초R", "평촌R", "강동R", "동작R", "강남R", "성동R"],
    "SLP": ["광명SLP", "광교SLP"],
    "MB": ["분당MB", "강남MB"],
    "알티": ["미사알티", "송파알티", "위례알티", "광교알티"],
}

# 대괄호 1쌍 추출
_BRACKET_RE = re.compile(r"\[([^\]]+)\]")


def expand_names(name_part):
    """쉼표로 구분된 원명/브랜드코드 토큰을 구체 원명 리스트로 확장.

    - 브랜드코드(P/E/R/SLP/MB/알티) → BRAND_EXPAND 전체로 치환 (동탄P 제외)
    - 일반 원명 → 그대로
    - 순서 보존 + 중복 제거
    """
    result = []
    for raw in name_part.split(","):
        token = raw.strip()
        if not token:
            continue
        expanded = BRAND_EXPAND.get(token, [token])
        for name in expanded:
            if name not in result:
                result.append(name)
    return result


def parse_bracket(content):
    """대괄호 1쌍의 내용을 규칙 dict 로 파싱.

    반환:
      {"names": [...], "action": "replace", "replacement": "대체메뉴"}
      {"names": [...], "action": "remove"}
      None  (후식과일 등 메뉴 교체와 무관하거나 해석 불가)
    """
    content = content.strip()
    if not content or content == "후식과일":
        return None

    if "-" not in content:
        # [원명X] 형태 → 항목 제거
        if content.endswith("X"):
            names = expand_names(content[:-1])
            if names:
                return {"names": names, "action": "remove"}
        return None

    name_part, menu_part = content.split("-", 1)
    names = expand_names(name_part)
    if not names:
        return None

    # [원명-메뉴명X] → 제거,  [원명-대체메뉴] → 교체
    if menu_part.endswith("X"):
        return {"names": names, "action": "remove"}
    return {"names": names, "action": "replace", "replacement": menu_part.strip()}


def resolve_for_branch(raw_value, branch):
    """메뉴 셀 1개의 원본 텍스트를 특정 원 기준으로 해석.

    - 대괄호 매칭(교체) → 해당 대체메뉴
    - 대괄호 매칭(제거) → '' (빈 문자열 = 항목 드롭)
    - 매칭 없음        → 대괄호 모두 제거한 기본메뉴
    """
    if not raw_value:
        return raw_value

    base = _BRACKET_RE.sub("", raw_value).strip()
    result = base

    for m in _BRACKET_RE.finditer(raw_value):
        rule = parse_bracket(m.group(1))
        if rule is None:
            continue
        if branch in rule["names"]:
            if rule["action"] == "remove":
                return ""
            if rule["action"] == "replace":
                result = rule["replacement"]
    return result


def wants_fruit(raw_value):
    """텍스트 안에 [후식과일] 플래그가 있는지."""
    if not raw_value:
        return False
    for m in _BRACKET_RE.finditer(raw_value):
        if m.group(1).strip() == "후식과일":
            return True
    return False


# ────────────────────────────────────────────────────────────────────────
# 단위 테스트 (python bracket_parser.py 로 직접 실행)
# ────────────────────────────────────────────────────────────────────────
def _run_tests():
    passed = 0
    failed = 0

    def check(name, got, expected):
        nonlocal passed, failed
        if got == expected:
            passed += 1
            print(f"  ✅ {name}")
        else:
            failed += 1
            print(f"  ❌ {name}\n     기대: {expected!r}\n     실제: {got!r}")

    print("[테스트 1] 브랜드코드 확장 (동탄P 제외)")
    p_list = expand_names("P")
    check("P 확장 개수 18", len(p_list), 18)
    check("동탄P 미포함", "동탄P" in p_list, False)
    check("수지P별관 포함", "수지P별관" in p_list, True)
    check("알티 확장", expand_names("알티"),
          ["미사알티", "송파알티", "위례알티", "광교알티"])

    print("[테스트 2] 대체(replace)")
    check("수지P 대체 적용",
          resolve_for_branch("시금치나물⑤[수지P-아욱나물]", "수지P"), "아욱나물")
    check("타 원은 기본메뉴",
          resolve_for_branch("시금치나물⑤[수지P-아욱나물]", "목동E"), "시금치나물⑤")

    print("[테스트 3] 제거(remove)")
    check("[원명-메뉴명X] 제거",
          resolve_for_branch("우유②[동탄P-우유X]", "동탄P"), "")
    check("[원명X] 제거",
          resolve_for_branch("멸치볶음[수지PX]", "수지P"), "")
    check("제거 규칙 비대상 원 유지",
          resolve_for_branch("멸치볶음[수지PX]", "목동E"), "멸치볶음")

    print("[테스트 4] 복수원 쉼표분리 + 브랜드코드 확장 적용")
    check("쉼표분리 KPI 대체",
          resolve_for_branch("된장국①[수지P,KPI-미역국①]", "KPI"), "미역국①")
    check("브랜드코드 P 일괄 대체(분당P 적용)",
          resolve_for_branch("백미밥[P-현미밥]", "분당P"), "현미밥")
    check("브랜드코드 P 확장에 동탄P 미적용",
          resolve_for_branch("백미밥[P-현미밥]", "동탄P"), "백미밥")
    check("후식과일 플래그 감지",
          wants_fruit("기본[후식과일]"), True)

    print(f"\n결과: {passed} 통과 / {failed} 실패")
    return failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if _run_tests() else 1)
