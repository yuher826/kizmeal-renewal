# -*- coding: utf-8 -*-
"""
키즈밀 식단표 PPTX 생성기
========================================================================

★ 대원칙: 디자이너 템플릿 100% 유지. 셀 텍스트(run.text)만 교체.
  폰트/색상/레이아웃/표 구조 절대 변경 금지.

★ 검증된 핵심: 알러지 원문자(①~⑲, 0x2460~0x2472)는 빨간색 별도 run.
  메뉴명(검정 run) + 알러지(빨강 run) 구조를 그대로 살려야 색상 유지됨.
  → split_menu_allergy() 로 분리해 run[0]=메뉴명, run[1]=알러지 로 주입.

❌ 절대 금지: cell.text = "내용"  (run/서식 전부 날아감)

⚠️ 일본어 금지. 모든 주석/문자열 한국어.
"""

from pptx import Presentation

from bracket_parser import resolve_for_branch

# 알러지 원문자 범위: ① ~ ⑲
_ALLERGY_LO = 0x2460
_ALLERGY_HI = 0x2472


# ════════════════════════════════════════════════════════════════════════
# 1. 검증된 셀 텍스트 교체 함수
# ════════════════════════════════════════════════════════════════════════
def split_menu_allergy(text):
    """메뉴명과 알러지 원문자(0x2460~0x2472) 분리."""
    allergy = "".join(c for c in text if _ALLERGY_LO <= ord(c) <= _ALLERGY_HI)
    menu = "".join(c for c in text if not (_ALLERGY_LO <= ord(c) <= _ALLERGY_HI))
    return menu, allergy


def strip_allergy(text):
    """알러지 원문자 ①~⑲ 전부 제거 (미표기 버전용)."""
    return "".join(c for c in text if not (_ALLERGY_LO <= ord(c) <= _ALLERGY_HI))


def _set_para_menu(para, line):
    """한 단락에 메뉴명(run0 검정) + 알러지(run1 빨강) 분리 주입."""
    runs = para.runs
    if not runs:
        return
    menu, allergy = split_menu_allergy(line)
    runs[0].text = menu
    if len(runs) >= 2:
        runs[1].text = allergy          # 빨간색 run 유지
        for r in runs[2:]:
            r.text = ""
    # run 이 1개뿐인 템플릿이면 메뉴+알러지 합쳐 주입(색 분리 불가하지만 안전)
    elif allergy:
        runs[0].text = menu + allergy


def set_lunch_cell(cell, lines):
    """중식 셀: 줄(단락)별로 메뉴명(검정)+알러지(빨강) 분리 교체.

    템플릿 단락 수가 입력 줄 수보다 많으면 나머지 단락은 비운다.
    """
    paras = cell.text_frame.paragraphs
    for i, para in enumerate(paras):
        if not para.runs:
            continue
        if i < len(lines):
            _set_para_menu(para, lines[i])
        else:
            for run in para.runs:
                run.text = ""


def set_snack_cell(cell, menu_line, kcal_line):
    """간식 셀: 첫 단락=메뉴(메뉴명+알러지 분리), 둘째 단락=Kcal."""
    done_menu = False
    done_kcal = False
    for para in cell.text_frame.paragraphs:
        if not para.runs:
            continue
        if not done_menu:
            _set_para_menu(para, menu_line)
            done_menu = True
        elif not done_kcal:
            para.runs[0].text = kcal_line
            for r in para.runs[1:]:
                r.text = ""
            done_kcal = True
        else:
            for run in para.runs:
                run.text = ""


def set_label_cell(cell, label):
    """라벨 셀(열0): 첫 run 만 교체 (특수처리 #1 오전→간식 등)."""
    for para in cell.text_frame.paragraphs:
        if not para.runs:
            continue
        para.runs[0].text = label
        for r in para.runs[1:]:
            r.text = ""
        return


def clear_cell(cell):
    """셀 내용만 비우기(서식 유지). 공휴일/휴주차/미입력 처리."""
    for para in cell.text_frame.paragraphs:
        for run in para.runs:
            run.text = ""


# ════════════════════════════════════════════════════════════════════════
# 2. 타입별 레이아웃 정의
# ════════════════════════════════════════════════════════════════════════
#  열0=라벨, 열1=월 … 열5=금. 행은 (섹션, 주차index 0~4) 의 순서 나열.
#  섹션: 'lunch' 중식 / 'am' 오전간식 / 'pm' 오후간식 / 'care' 돌봄간식(저녁행)
def _week_rows(sections):
    """5주 × sections 순서로 (섹션,주차) 행 리스트 생성."""
    rows = []
    for week in range(5):
        for sec in sections:
            rows.append({"sec": sec, "week": week})
    return rows


# 각 타입 = 슬라이드 리스트. 슬라이드 = {rows, skip?, eng?, strip?}
#  skip  : 슬라이드 통째 건드리지 않음 (건강정보지 등)
#  eng   : 영문 슬라이드 (메뉴는 한글 그대로 → 일반 렌더와 동일)
#  strip : 알러지 미표기 (①~⑲ 제거)
TYPE_SPECS = {
    # A: S1 10행 (중식+오전간식)
    "A": {"slides": [{"rows": _week_rows(["lunch", "am"])}]},

    # B: S1 10행(중식+간식) + S2 5행(오후간식)
    "B": {"slides": [
        {"rows": _week_rows(["lunch", "am"])},
        {"rows": _week_rows(["pm"])},
    ]},

    # C: S1 15행 (중식+오전+오후, 3행1세트)
    "C": {"slides": [{"rows": _week_rows(["lunch", "am", "pm"])}]},

    # D: S1 15행 + S2 15행 (둘 다 동일 데이터)
    "D": {"slides": [
        {"rows": _week_rows(["lunch", "am", "pm"])},
        {"rows": _week_rows(["lunch", "am", "pm"])},
    ]},

    # E: S1 10행(중식+간식, 5주차만 '오전' 라벨) + S2/S3 빈 슬라이드(건드리지 않음)
    "E": {"slides": [
        {"rows": _week_rows(["lunch", "am"])},
        {"skip": True},
        {"skip": True},
    ]},

    # F: S1 10행 국문 + S2 10행 영문 + S3 5행 국문오후 + S4 5행 영문오후
    "F": {"slides": [
        {"rows": _week_rows(["lunch", "am"])},
        {"rows": _week_rows(["lunch", "am"]), "eng": True},
        {"rows": _week_rows(["pm"])},
        {"rows": _week_rows(["pm"]), "eng": True},
    ]},

    # G: S1 10행 + S2 5행(알러지표기) + S3 10행 + S4 5행(알러지미표기)
    "G": {"slides": [
        {"rows": _week_rows(["lunch", "am"])},
        {"rows": _week_rows(["pm"])},
        {"rows": _week_rows(["lunch", "am"]), "strip": True},
        {"rows": _week_rows(["pm"]), "strip": True},
    ]},

    # 송파E: S1 10행(중식+오전) + S2 10행(오후/저녁 교대, 저녁=돌봄간식)
    "songpaE": {"slides": [
        {"rows": _week_rows(["lunch", "am"])},
        {"rows": _week_rows(["pm", "care"])},
    ]},
}


# ════════════════════════════════════════════════════════════════════════
# 3. 타입 판단 (원별 참조표 자동 판단용 — 현재는 참조표의 명시 type 이 우선)
# ════════════════════════════════════════════════════════════════════════
def determine_type(am=True, pm=True, slides=1, eng=False,
                   label="오전", care=False, allergy=True, note=""):
    """원별 속성 → 타입 코드 추정(best-effort).

    실제 생성은 test_data 의 명시 type 을 사용한다. 본 함수는 다음 단계(49개
    확대) 에서 참조표 자동분류에 쓰일 휴리스틱이다.
    """
    if care:
        return "songpaE"          # 돌봄간식(저녁행) 보유
    if not allergy:
        return "G"                # 알러지 미표기 슬라이드 동반
    if eng:
        return "F"                # 영문 슬라이드 동반
    if slides >= 2 and pm:
        return "D" if slides >= 2 and label == "오전" and slides == 2 else "B"
    if pm:
        return "C"                # 한 슬라이드에 오후간식까지
    return "A"


# ════════════════════════════════════════════════════════════════════════
# 4. 메뉴 → 셀 라인 빌더 (대괄호 원별 오버라이드 적용)
# ════════════════════════════════════════════════════════════════════════
_LUNCH_ITEM_KEYS = [
    "bap", "guk", "banchan1", "banchan2", "banchan3", "banchan4", "banchan5",
]


def build_lunch_lines(lunch, branch, do_strip=False, fruit=None):
    """중식 셀 라인 리스트 생성.

    순서: 밥/국/반찬1~5/(후식과일)/영양구성.
    대괄호 원별 오버라이드 적용 후 빈 항목 제거.
    """
    lines = []
    for key in _LUNCH_ITEM_KEYS:
        resolved = resolve_for_branch(lunch.get(key, ""), branch)
        if resolved and resolved.strip():
            lines.append(resolved.strip())

    if fruit:
        lines.append(fruit)

    nutrition = lunch.get("nutrition", "")
    if nutrition and nutrition.strip():
        lines.append(nutrition.strip())

    if do_strip:
        lines = [strip_allergy(x) for x in lines]
    return lines


def build_snack(snack, branch, do_strip=False, pm_replace=None):
    """간식 셀 (메뉴, Kcal) 쌍 생성. pm_replace=(찾을말,바꿀말)."""
    menu = resolve_for_branch(snack.get("menu", ""), branch)
    kcal = snack.get("nutrition", "")
    if pm_replace:
        menu = menu.replace(pm_replace[0], pm_replace[1])
    if do_strip:
        menu = strip_allergy(menu)
    return menu.strip(), kcal.strip()


# ════════════════════════════════════════════════════════════════════════
# 5. 표/슬라이드 헬퍼
# ════════════════════════════════════════════════════════════════════════
def _get_table(slide):
    """슬라이드 첫 번째 표 반환 (없으면 None)."""
    for shape in slide.shapes:
        if shape.has_table:
            return shape.table
    return None


def _days_by_week(menu):
    """{주차번호(1~5): [월,화,수,목,금] 일자 dict or None}.

    upload route 의 menu_data 구조(weeks[str]→days[]) 와 정합.
    days 는 월~금 순서로 정렬돼 있다고 가정, 5칸으로 맞춤.
    """
    out = {}
    weeks = menu.get("weeks", {})
    for wk in range(1, 6):
        wdata = weeks.get(str(wk))
        if not wdata or wdata.get("is_skipped"):
            out[wk] = [None] * 5
            continue
        days = wdata.get("days", [])
        padded = list(days[:5]) + [None] * (5 - len(days))
        out[wk] = padded
    return out


# ════════════════════════════════════════════════════════════════════════
# 6. 슬라이드 렌더링
# ════════════════════════════════════════════════════════════════════════
def _render_slide(table, slide_spec, week_days, cfg):
    """슬라이드 1장의 표를 채운다."""
    do_strip = slide_spec.get("strip", False)
    snack_label = cfg.get("snack_label", "오전")
    type_code = cfg["type"]
    add_fruit = cfg.get("add_fruit", False)
    fruit_text = cfg.get("fruit_text", "제철과일")
    fixed_am = cfg.get("fixed_am")          # 특수#2 동탄P: {"menu":..,"kcal":..}
    pm_replace = cfg.get("pm_replace")      # 특수#3 KPI: [찾을말, 바꿀말]

    rows = slide_spec["rows"]
    n_table_rows = len(table.rows)

    for ridx, spec in enumerate(rows):
        if ridx >= n_table_rows:
            break
        sec = spec["sec"]
        week = spec["week"]            # 0~4
        days = week_days.get(week + 1, [None] * 5)
        row = table.rows[ridx]
        cells = row.cells

        # ── 특수처리 #1: 간식 라벨 오전→간식 교체 (필요 원만) ──────────
        if sec == "am" and snack_label == "간식":
            # 타입 E/F 는 5주차(week==4)만 '오전' 유지 → 그 행은 라벨 건드리지 않음
            if not (type_code in ("E", "F") and week == 4):
                set_label_cell(cells[0], "간식")

        # 데이터 열: 열1(월)~열5(금)
        for col in range(5):
            if col + 1 >= len(cells):
                break
            cell = cells[col + 1]
            day = days[col]

            # 휴주차/미입력 → 빈칸 (특수#5)
            if day is None:
                clear_cell(cell)
                continue

            if sec == "lunch":
                # 공휴일 → 중식 빈칸 (특수#6)
                if day.get("is_holiday"):
                    clear_cell(cell)
                    continue
                fruit = fruit_text if add_fruit else None   # 특수#7 잉파/엘란
                lines = build_lunch_lines(day.get("lunch", {}), cfg["name"],
                                          do_strip=do_strip, fruit=fruit)
                set_lunch_cell(cell, lines)

            elif sec == "am":
                if fixed_am:                                # 특수#2 동탄P 고정
                    set_snack_cell(cell, fixed_am["menu"], fixed_am["kcal"])
                    continue
                menu, kcal = build_snack(day.get("morning_snack", {}),
                                         cfg["name"], do_strip=do_strip)
                set_snack_cell(cell, menu, kcal)

            elif sec == "pm":
                menu, kcal = build_snack(day.get("afternoon_snack", {}),
                                         cfg["name"], do_strip=do_strip,
                                         pm_replace=pm_replace)   # 특수#3 KPI
                set_snack_cell(cell, menu, kcal)

            elif sec == "care":                             # 특수#4 송파E 저녁=돌봄
                menu, kcal = build_snack(day.get("care_snack", {}),
                                         cfg["name"], do_strip=do_strip)
                set_snack_cell(cell, menu, kcal)


# ════════════════════════════════════════════════════════════════════════
# 7. 메인 생성 함수
# ════════════════════════════════════════════════════════════════════════
def generate(cfg, menu, template_path, out_path):
    """원 1개 PPTX 생성.

    cfg          : 원별 설정 (name, type, snack_label, add_fruit, ...)
    menu         : 월간 메뉴 데이터 (weeks/days)
    template_path: 입력 템플릿 .pptx
    out_path     : 출력 .pptx
    """
    type_code = cfg["type"]
    spec = TYPE_SPECS.get(type_code)
    if spec is None:
        raise ValueError(f"알 수 없는 타입: {type_code}")

    prs = Presentation(template_path)
    week_days = _days_by_week(menu)
    slides = list(prs.slides)

    for sidx, slide_spec in enumerate(spec["slides"]):
        if slide_spec.get("skip"):          # 특수#10 목동P S2/S3 건드리지 않음
            continue
        if sidx >= len(slides):
            break
        table = _get_table(slides[sidx])
        if table is None:
            continue
        # eng 슬라이드(특수#9): 메뉴 한글 그대로 → 일반 렌더와 동일 처리
        _render_slide(table, slide_spec, week_days, cfg)

    prs.save(out_path)
    return out_path
