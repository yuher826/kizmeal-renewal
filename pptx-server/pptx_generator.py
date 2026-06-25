# -*- coding: utf-8 -*-
"""
키즈밀 식단표 PPTX 생성기 (빈 양식 1개 → 49개원 자동생성)
========================================================================

★ 대원칙: 빈 양식 슬라이드 XML을 zipfile 수준에서 재조합 후
  <a:t> 텍스트만 교체 (cell.text= 절대 금지).

빈 양식 슬라이드 구성:
  S1 (idx=0): 15행 = (중식+오전+오후) × 5주   (타입C/D)
  S2 (idx=1): 10행 = (중식+오전) × 5주         (타입A/B/E/F/G/songpaE)
  S3 (idx=2):  5행 = 오후간식 × 5주            (타입B/F/G)

셀 XML 구조 (양식.pptx 기준):
  중식 셀: <a:p>... <a:r>행1</a:r><a:br/><a:r>행2</a:r>... (7 run + 6 br)
  간식 셀: <a:p>... <a:r>메뉴</a:r>  (1 run; kcal은 <a:br>+<a:r> 추가)
  빈 셀(col2-5, 2주~5주): run 없음 → _init_table_cells로 구조 복사

⚠️  일본어 금지. 모든 주석/문자열 한국어.
"""

import copy
import io
import re
import zipfile

from lxml import etree
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.util import Emu

from bracket_parser import resolve_for_branch

# ── 알러지 원문자 범위 ①~⑲ ─────────────────────────────────────────
_ALLERGY_LO, _ALLERGY_HI = 0x2460, 0x2472

# ── XML 네임스페이스 ───────────────────────────────────────────────
_NS_A   = 'http://schemas.openxmlformats.org/drawingml/2006/main'
_NS_PML = 'http://schemas.openxmlformats.org/presentationml/2006/main'
_NS_R   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
_NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
_NS_CT  = 'http://schemas.openxmlformats.org/package/2006/content-types'

_SLIDE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'

_S1, _S2, _S3 = 0, 1, 2

# ── 공휴일에도 운영하는 원 ────────────────────────────────────────
_HOLIDAY_OPERATING = {'덕양P', '광교SLP'}

# ── 행 높이 고정값 (EMU) ─────────────────────────────────────────
_H_LUNCH = 1368000
_H_SNACK = 403200
_H_LAST  = 437413


# ════════════════════════════════════════════════════════════════════
# 1. 타입별 슬라이드 플랜
# ════════════════════════════════════════════════════════════════════
TYPE_PLANS = {
    'A':       [(_S2, ['lunch', 'am'],            {})],
    'B':       [(_S2, ['lunch', 'am'],            {}),
                (_S3, ['pm'],                     {})],
    'C':       [(_S1, ['lunch', 'am', 'pm'],      {})],
    'D':       [(_S1, ['lunch', 'am', 'pm'],      {}),
                (_S1, ['lunch', 'am', 'pm'],      {})],
    'E':       [(_S2, ['lunch', 'am'],            {}),
                (_S1, [],                          {'skip': True}),
                (_S3, [],                          {'skip': True})],
    'F':       [(_S2, ['lunch', 'am'],            {}),
                (_S2, ['lunch', 'am'],             {'eng': True}),
                (_S3, ['pm'],                      {}),
                (_S3, ['pm'],                      {'eng': True})],
    'G':       [(_S2, ['lunch', 'am'],            {}),
                (_S3, ['pm'],                      {}),
                (_S2, ['lunch', 'am'],             {'strip': True}),
                (_S3, ['pm'],                      {'strip': True})],
    'songpaE': [(_S2, ['lunch', 'am'],            {}),
                (_S2, ['pm', 'care'],              {'care_label': '저녁'})],
}


# ════════════════════════════════════════════════════════════════════
# 2. ZIP 기반 슬라이드 플랜 → Presentation
# ════════════════════════════════════════════════════════════════════
def build_pptx_from_plan(template_path, slide_indices):
    with zipfile.ZipFile(template_path, 'r') as zf:
        file_map = {n: zf.read(n) for n in zf.namelist()}

    prs_xml  = etree.fromstring(file_map['ppt/presentation.xml'])
    sldIdLst = prs_xml.find(f'.//{{{_NS_PML}}}sldIdLst')
    prs_rels = etree.fromstring(file_map['ppt/_rels/presentation.xml.rels'])

    rId_to_target = {}
    for rel in prs_rels:
        t = rel.get('Type', '')
        if ('slide' in t and 'slideLayout' not in t
                and 'slideMaster' not in t and 'notes' not in t.lower()):
            rId_to_target[rel.get('Id')] = rel.get('Target')

    template_slide_files = []
    for sldId in sldIdLst:
        rId = sldId.get(f'{{{_NS_R}}}id')
        target = rId_to_target.get(rId)
        if target:
            template_slide_files.append('ppt/' + target)

    new_files = {}
    for name, data in file_map.items():
        is_slide = name.startswith('ppt/slides/slide') and name.endswith('.xml')
        is_notes = name.startswith('ppt/notesSlides/')
        if not is_slide and not is_notes:
            new_files[name] = data

    new_targets = []
    for i, t_idx in enumerate(slide_indices):
        src = template_slide_files[t_idx]
        dst = f'ppt/slides/slide{i+1}.xml'
        new_files[dst] = file_map[src]

        src_rels = src.replace('/slides/', '/slides/_rels/').replace('.xml', '.xml.rels')
        dst_rels = f'ppt/slides/_rels/slide{i+1}.xml.rels'
        if src_rels in file_map:
            rx = etree.fromstring(file_map[src_rels])
            for rel in list(rx):
                if 'notes' in rel.get('Type', '').lower():
                    rx.remove(rel)
            new_files[dst_rels] = etree.tostring(
                rx, xml_declaration=True, encoding='UTF-8', standalone=True)

        new_targets.append(f'slides/slide{i+1}.xml')

    for child in list(sldIdLst):
        sldIdLst.remove(child)
    for rel in list(prs_rels):
        t = rel.get('Type', '')
        if ('slide' in t and 'slideLayout' not in t
                and 'slideMaster' not in t and 'notes' not in t.lower()):
            prs_rels.remove(rel)

    for i, target in enumerate(new_targets):
        rid = f'rId_s{i+1}'
        etree.SubElement(prs_rels, f'{{{_NS_PKG}}}Relationship', {
            'Id': rid, 'Type': _SLIDE_REL_TYPE, 'Target': target,
        })
        elem = etree.SubElement(sldIdLst, f'{{{_NS_PML}}}sldId', {'id': str(300 + i)})
        elem.set(f'{{{_NS_R}}}id', rid)

    ct_xml   = etree.fromstring(new_files['[Content_Types].xml'])
    slide_ct = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
    for ov in list(ct_xml):
        pn = ov.get('PartName', '')
        if '/slides/slide' in pn and 'Layout' not in pn and 'Master' not in pn:
            ct_xml.remove(ov)
    for i in range(len(new_targets)):
        etree.SubElement(ct_xml, f'{{{_NS_CT}}}Override', {
            'PartName': f'/ppt/slides/slide{i+1}.xml',
            'ContentType': slide_ct,
        })

    def _b(elem):
        return etree.tostring(elem, xml_declaration=True, encoding='UTF-8', standalone=True)

    new_files['ppt/presentation.xml']           = _b(prs_xml)
    new_files['ppt/_rels/presentation.xml.rels'] = _b(prs_rels)
    new_files['[Content_Types].xml']             = _b(ct_xml)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, data in new_files.items():
            zf.writestr(name, data)
    buf.seek(0)
    return Presentation(buf)


# ════════════════════════════════════════════════════════════════════
# 3. 표 셀 XML 초기화 (빈 셀 + 타입 불일치 셀 → 올바른 구조로 교체)
# ════════════════════════════════════════════════════════════════════
def _make_snack_tmpl_from_lunch(lunch_tmpl):
    """7-run 중식 txBody에서 1-run 간식 txBody 파생."""
    tmpl = copy.deepcopy(lunch_tmpl)
    p = tmpl.find(f'{{{_NS_A}}}p')
    if p is None:
        return tmpl
    runs = p.findall(f'{{{_NS_A}}}r')
    brs  = p.findall(f'{{{_NS_A}}}br')
    for r in runs[1:]:
        p.remove(r)
    for br in brs:
        p.remove(br)
    return tmpl


def _init_table_cells(table, sections):
    """
    데이터 셀(col1~N)의 txBody를 섹션 타입에 맞게 초기화.
    - run 없는 빈 셀 → 적절한 template 복사
    - 타입 불일치(lunch template in snack row) → 올바른 template으로 교체
    """
    n_cols = len(table.columns)
    n_secs = len(sections)

    # 모든 col1 셀에서 lunch(≥5 run) / snack(1~2 run) template 추출
    lunch_tmpl = None
    snack_tmpl = None
    for ri in range(len(table.rows)):
        src_txBody = table.cell(ri, 1)._tc.find(f'{{{_NS_A}}}txBody')
        if src_txBody is None:
            continue
        n = len(src_txBody.findall(f'.//{{{_NS_A}}}r'))
        if n >= 5 and lunch_tmpl is None:
            lunch_tmpl = copy.deepcopy(src_txBody)
        elif 1 <= n <= 2 and snack_tmpl is None:
            snack_tmpl = copy.deepcopy(src_txBody)
        if lunch_tmpl is not None and snack_tmpl is not None:
            break

    # S3 처럼 snack_tmpl이 없으면 lunch_tmpl 에서 파생
    if snack_tmpl is None and lunch_tmpl is not None:
        snack_tmpl = _make_snack_tmpl_from_lunch(lunch_tmpl)

    def _tmpl(sec):
        return lunch_tmpl if sec == 'lunch' else snack_tmpl

    for ri in range(len(table.rows)):
        sec  = sections[ri % n_secs]
        tmpl = _tmpl(sec)
        if tmpl is None:
            continue
        need_lunch = (sec == 'lunch')
        for ci in range(1, n_cols):
            dst_tc     = table.cell(ri, ci)._tc
            dst_txBody = dst_tc.find(f'{{{_NS_A}}}txBody')
            if dst_txBody is None:
                continue
            cur_n  = len(dst_txBody.findall(f'.//{{{_NS_A}}}r'))
            has_lunch = (cur_n >= 5)
            # 비어있거나 타입 불일치이면 교체
            if cur_n == 0 or (need_lunch != has_lunch):
                dst_tc.replace(dst_txBody, copy.deepcopy(tmpl))


# ════════════════════════════════════════════════════════════════════
# 4. 알러지 유틸
# ════════════════════════════════════════════════════════════════════
def split_menu_allergy(text):
    allergy = ''.join(c for c in text if _ALLERGY_LO <= ord(c) <= _ALLERGY_HI)
    menu    = ''.join(c for c in text if not (_ALLERGY_LO <= ord(c) <= _ALLERGY_HI))
    return menu, allergy


def strip_allergy(text):
    return ''.join(c for c in text if not (_ALLERGY_LO <= ord(c) <= _ALLERGY_HI))


# ════════════════════════════════════════════════════════════════════
# 5. 셀 텍스트 교체 (XML 직접 조작)
# ════════════════════════════════════════════════════════════════════
def _get_p_and_runs(cell):
    """셀 첫 단락(p)과 <a:r> 리스트 반환."""
    tc     = cell._tc
    txBody = tc.find(f'{{{_NS_A}}}txBody')
    if txBody is None:
        return None, []
    p = txBody.find(f'{{{_NS_A}}}p')
    if p is None:
        return None, []
    runs = p.findall(f'{{{_NS_A}}}r')
    return p, runs


def _set_run_text(run, text):
    t_elem = run.find(f'{{{_NS_A}}}t')
    if t_elem is not None:
        t_elem.text = text


def _make_allergy_run(template_run, allergy_text):
    """알레르기 번호 전용 빨간색(FF0000) run 생성 후 반환"""
    new_run = copy.deepcopy(template_run)
    rPr = new_run.find(f'{{{_NS_A}}}rPr')
    if rPr is not None:
        # 기존 solidFill 제거 (list()로 복사본 순회해야 안전)
        for child in list(rPr):
            if child.tag == f'{{{_NS_A}}}solidFill':
                rPr.remove(child)
        # FF0000 solidFill 첫 번째 자식으로 삽입
        solid = etree.Element(f'{{{_NS_A}}}solidFill')
        srgb  = etree.SubElement(solid, f'{{{_NS_A}}}srgbClr')
        srgb.set('val', 'FF0000')
        rPr.insert(0, solid)
    # 텍스트 교체
    t = new_run.find(f'{{{_NS_A}}}t')
    if t is None:
        t = etree.SubElement(new_run, f'{{{_NS_A}}}t')
    t.text = allergy_text
    return new_run


def _apply_inline_allergy(template_run, text, p):
    """간식 셀용: 텍스트 내 알레르기 번호를 인라인 분리해 빨간색 run 삽입.
    예) '삶은계란①, 요구르트②'
        → run(삶은계란) + run_red(①) + run(, 요구르트) + run_red(②)
    """
    segments = []
    current = ''
    is_allergy = None
    for char in text:
        char_is_allergy = _ALLERGY_LO <= ord(char) <= _ALLERGY_HI
        if is_allergy is None:
            is_allergy = char_is_allergy
        if char_is_allergy != is_allergy:
            if current:
                segments.append((current, is_allergy))
            current = char
            is_allergy = char_is_allergy
        else:
            current += char
    if current:
        segments.append((current, is_allergy))

    if not segments:
        _set_run_text(template_run, '')
        return

    first_text, first_is_allergy = segments[0]
    if first_is_allergy:
        _set_run_text(template_run, '')
        insert_pos = list(p).index(template_run) + 1
        p.insert(insert_pos, _make_allergy_run(template_run, first_text))
        insert_pos += 1
    else:
        _set_run_text(template_run, first_text)
        insert_pos = list(p).index(template_run) + 1

    for seg_text, seg_is_allergy in segments[1:]:
        if seg_is_allergy:
            new_run = _make_allergy_run(template_run, seg_text)
        else:
            new_run = copy.deepcopy(template_run)
            t_elem = new_run.find(f'{{{_NS_A}}}t')
            if t_elem is None:
                t_elem = etree.SubElement(new_run, f'{{{_NS_A}}}t')
            t_elem.text = seg_text
        p.insert(insert_pos, new_run)
        insert_pos += 1


def _make_date_paragraph(date_num):
    """날짜 전용 paragraph 생성: 왼쪽 정렬, #84B29C, 9pt, 볼드, Pretendard."""
    date_p = etree.Element(f'{{{_NS_A}}}p')

    pPr = etree.SubElement(date_p, f'{{{_NS_A}}}pPr')
    pPr.set('algn', 'l')

    rPr = etree.Element(f'{{{_NS_A}}}rPr')
    rPr.set('lang', 'ko-KR')
    rPr.set('sz', '900')
    rPr.set('b', '1')
    rPr.set('dirty', '0')

    solidFill = etree.SubElement(rPr, f'{{{_NS_A}}}solidFill')
    srgbClr   = etree.SubElement(solidFill, f'{{{_NS_A}}}srgbClr')
    srgbClr.set('val', '84B29C')

    latin = etree.SubElement(rPr, f'{{{_NS_A}}}latin')
    latin.set('typeface', 'Pretendard')
    ea = etree.SubElement(rPr, f'{{{_NS_A}}}ea')
    ea.set('typeface', 'Pretendard')

    run = etree.SubElement(date_p, f'{{{_NS_A}}}r')
    run.append(rPr)
    t = etree.SubElement(run, f'{{{_NS_A}}}t')
    t.text = date_num

    return date_p


def set_lunch_cell(cell, lines, date_num=None):
    """
    중식 셀: run-br-run-br-... 구조에서 각 run에 라인별 텍스트 주입.
    lines: [밥, 국, 반찬1, ..., 영양구성] (최대 7개)
    date_num: 일자 문자열 (예: '01') — 있으면 별도 paragraph를 셀 맨 앞에 삽입
    """
    p, runs = _get_p_and_runs(cell)
    if not runs:
        return

    if date_num:
        # 날짜 전용 paragraph를 기존 메뉴 p 앞에 삽입
        txBody = p.getparent()
        date_p = _make_date_paragraph(date_num)
        p_idx  = list(txBody).index(p)
        txBody.insert(p_idx, date_p)

    for i, run in enumerate(runs):
        text = lines[i] if i < len(lines) else ''
        menu, allergy = split_menu_allergy(text)
        _set_run_text(run, menu)
        if allergy:
            allergy_run = _make_allergy_run(run, allergy)
            p = run.getparent()           # run 자체에서 부모 <a:p> 직접 획득 (안전)
            run_idx = list(p).index(run)
            p.insert(run_idx + 1, allergy_run)


def _set_date_only_cell(cell, date_num):
    """빈 셀(공휴일 clear 후)에 날짜 paragraph 1개만 삽입."""
    tc     = cell._tc
    txBody = tc.find(f'{{{_NS_A}}}txBody')
    if txBody is None or not date_num:
        return
    # 기존 p 앞에 날짜 paragraph 삽입 (빈 p는 그대로 두어 셀 구조 유지)
    existing_p = txBody.find(f'{{{_NS_A}}}p')
    date_p     = _make_date_paragraph(date_num)
    if existing_p is not None:
        p_idx = list(txBody).index(existing_p)
        txBody.insert(p_idx, date_p)
    else:
        txBody.append(date_p)


def set_snack_cell(cell, menu_line, kcal_line):
    """
    간식 셀: 첫 run에 메뉴, br+run 추가로 kcal.
    """
    p, runs = _get_p_and_runs(cell)
    if p is None or not runs:
        return

    _apply_inline_allergy(runs[0], menu_line, runs[0].getparent())

    if kcal_line:
        if len(runs) >= 2:
            _set_run_text(runs[1], kcal_line)
        else:
            rPr = runs[0].find(f'{{{_NS_A}}}rPr')
            br  = etree.Element(f'{{{_NS_A}}}br')
            if rPr is not None:
                br.append(copy.deepcopy(rPr))
            p.append(br)
            new_run = etree.Element(f'{{{_NS_A}}}r')
            if rPr is not None:
                new_run.append(copy.deepcopy(rPr))
            t = etree.SubElement(new_run, f'{{{_NS_A}}}t')
            t.text = kcal_line
            p.append(new_run)
    else:
        if len(runs) >= 2:
            _set_run_text(runs[1], '')


def set_label_cell(cell, label):
    _, runs = _get_p_and_runs(cell)
    if runs:
        _set_run_text(runs[0], label)


def clear_cell(cell):
    """셀 내 모든 run·br 제거 → endParaRPr만 남은 완전 빈 셀."""
    p, _ = _get_p_and_runs(cell)
    if p is None:
        return
    for child in list(p):
        tag = child.tag
        if tag == f'{{{_NS_A}}}r' or tag == f'{{{_NS_A}}}br':
            p.remove(child)


# ════════════════════════════════════════════════════════════════════
# 6. 메뉴 → 셀 라인 빌더
# ════════════════════════════════════════════════════════════════════
_LUNCH_KEYS = ['bap', 'guk', 'banchan1', 'banchan2', 'banchan3', 'banchan4', 'banchan5']


def build_lunch_lines(lunch, branch, do_strip=False, add_fruit=False, fruit_text='제철과일'):
    lines = []
    for key in _LUNCH_KEYS:
        resolved = resolve_for_branch(lunch.get(key, ''), branch)
        if resolved and resolved.strip():
            if do_strip:
                resolved = strip_allergy(resolved)
            lines.append(resolved.strip())

    if add_fruit and lunch.get('has_fruit'):
        lines.append(fruit_text)

    nutri = lunch.get('nutrition', '')
    if nutri and nutri.strip():
        lines.append(nutri.strip())

    return lines


def build_snack(snack, branch, do_strip=False):
    menu = resolve_for_branch(snack.get('menu', ''), branch)
    kcal = snack.get('nutrition', '')
    if do_strip:
        menu = strip_allergy(menu)
    return menu.strip(), kcal.strip()


# ════════════════════════════════════════════════════════════════════
# 7. 슬라이드 메타데이터 교체
# ════════════════════════════════════════════════════════════════════
def _iter_all_shapes(shapes):
    for s in shapes:
        yield s
        if s.shape_type == MSO_SHAPE_TYPE.GROUP:
            try:
                yield from _iter_all_shapes(s.shapes)
            except Exception:
                pass


def _replace_in_tf(tf, find, replace):
    for para in tf.paragraphs:
        runs = para.runs
        if not runs:
            continue
        for run in runs:
            if find in run.text:
                run.text = run.text.replace(find, replace)
                return True
        combined = ''.join(r.text for r in runs)
        if find in combined:
            runs[0].text = combined.replace(find, replace)
            for r in runs[1:]:
                r.text = ''
            return True
    return False


def replace_slide_metadata(slide, display_name, email):
    for shape in _iter_all_shapes(slide.shapes):
        if not shape.has_text_frame:
            continue
        tf = shape.text_frame
        _replace_in_tf(tf, 'OOO 지점', f'{display_name} 지점')
        _replace_in_tf(tf, 'OOO 영양사', '영양사')
        _replace_in_tf(tf, 'OOOOOOO@kizmeal.com', email)


_DATE_NUM_RE = re.compile(r'^(0[1-9]|[12][0-9]|3[01])$')


def replace_date_group(slide, date_map=None):
    """
    lxml으로 spTree를 직접 순회해 전체 텍스트가 '01'~'31'인
    p:sp를 완전 삭제 (그룹 중첩 깊이 무관).
    """
    spTree = slide.shapes._spTree
    _SP_TAG = f'{{{_NS_PML}}}sp'
    _T_TAG  = f'{{{_NS_A}}}t'

    # 먼저 삭제 대상 수집 후 제거 (순회 중 remove 방지)
    to_remove = []
    for sp in spTree.findall(f'.//{_SP_TAG}'):
        txt = ''.join(t.text or '' for t in sp.findall(f'.//{_T_TAG}')).strip()
        if _DATE_NUM_RE.match(txt):
            to_remove.append(sp)

    for sp in to_remove:
        parent = sp.getparent()
        if parent is not None:
            parent.remove(sp)


# ════════════════════════════════════════════════════════════════════
# 8. 표 헬퍼
# ════════════════════════════════════════════════════════════════════
def _get_table(slide):
    # 1순위: MENU_TABLE 이름표로 찾기
    for shape in slide.shapes:
        try:
            if shape.name == 'MENU_TABLE' and shape.has_table:
                return shape.table
        except Exception:
            continue
    # 2순위: 첫 번째 has_table 폴백 (이름표 없는 기존 템플릿 대응)
    for shape in slide.shapes:
        try:
            if shape.has_table:
                return shape.table
        except Exception:
            continue
    return None


def _days_by_week(menu_data):
    out   = {}
    weeks = menu_data.get('weeks', {})
    for wk in range(1, 6):
        wdata = weeks.get(str(wk))
        if not wdata:
            out[wk] = [None] * 5
            continue
        days   = wdata.get('days', [])
        padded = []
        for d in days[:5]:
            padded.append(None if (d is None or d.get('is_skipped')) else d)
        padded += [None] * (5 - len(padded))
        out[wk] = padded
    return out


# ════════════════════════════════════════════════════════════════════
# 8-1. 이름표(cNvPr name) 기반 도형 탐색
# ════════════════════════════════════════════════════════════════════
def find_shape_by_name(slide_el, target_name):
    """
    이름표(cNvPr name)로 도형 찾기.
    sp(텍스트박스), graphicFrame(표), grpSp(그룹) 모두 탐색.
    ALLERGY_BOX는 그룹이라 grpSp까지 봐야 함.
    찾으면 element 반환, 없으면 None.
    """
    ns_p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    for tag in ('sp', 'graphicFrame', 'grpSp'):
        for el in slide_el.iter(f'{{{ns_p}}}{tag}'):
            cNvPr = el.find(f'.//{{{ns_p}}}cNvPr')
            if cNvPr is not None and cNvPr.get('name') == target_name:
                return el
    return None


def find_shape_smart(slide_el, target_name, fallback_keyword=None):
    """
    이름표 우선 탐색, 없으면 텍스트 키워드로 폴백.
    기존 템플릿(이름표 없음)과 새 템플릿(이름표 있음) 모두 지원.
    """
    ns_p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    ns_a = 'http://schemas.openxmlformats.org/drawingml/2006/main'

    # 1순위: 이름표로 찾기
    el = find_shape_by_name(slide_el, target_name)
    if el is not None:
        return el, 'name'

    # 2순위: 텍스트 키워드로 폴백
    if fallback_keyword:
        for sp in slide_el.iter(f'{{{ns_p}}}sp'):
            texts = ''.join(t.text or '' for t in sp.findall(f'.//{{{ns_a}}}t'))
            if fallback_keyword in texts:
                return sp, 'keyword'

    return None, None


# ════════════════════════════════════════════════════════════════════
# 9. 슬라이드 렌더링
# ════════════════════════════════════════════════════════════════════
def _render_slide(table, plan_entry, week_days, cfg):
    _, sections, opts = plan_entry
    if opts.get('skip') or not sections:
        return

    do_strip    = opts.get('strip', False)
    care_label  = opts.get('care_label')
    snack_label = cfg.get('snack_label', '오전')
    add_fruit   = cfg.get('add_fruit', False)
    fruit_text  = cfg.get('fruit_text', '제철과일')
    fixed_am    = cfg.get('fixed_am')
    use_pm_as_am= cfg.get('use_pm_as_am', False)
    branch_name = cfg['name']

    _init_table_cells(table, sections)

    n_rows  = len(table.rows)
    row_idx = 0

    for wk in range(1, 6):
        days = week_days.get(wk, [None] * 5)
        for sec in sections:
            if row_idx >= n_rows:
                break
            row   = table.rows[row_idx]
            cells = row.cells
            row_idx += 1

            if sec == 'am' and snack_label == '간식':
                set_label_cell(cells[0], '간식')
            elif sec == 'care' and care_label:
                set_label_cell(cells[0], care_label)

            for col in range(5):
                if col + 1 >= len(cells):
                    break
                cell = cells[col + 1]
                day  = days[col]

                if day is None:
                    clear_cell(cell)
                    continue

                if sec == 'lunch':
                    date_str = day.get('date', '')
                    day_num  = date_str.split('-')[2] if len(date_str) == 10 else ''
                    if day.get('is_holiday') and branch_name not in _HOLIDAY_OPERATING:
                        clear_cell(cell)
                        _set_date_only_cell(cell, day_num)
                        continue
                    lines = build_lunch_lines(
                        day.get('lunch', {}), branch_name,
                        do_strip=do_strip,
                        add_fruit=add_fruit,
                        fruit_text=fruit_text,
                    )
                    if not lines:
                        # 운영원 공휴일이지만 데이터 없는 경우 — 날짜만 표시
                        clear_cell(cell)
                        _set_date_only_cell(cell, day_num)
                        continue
                    set_lunch_cell(cell, lines, date_num=day_num)

                elif sec == 'am':
                    if day.get('is_holiday') and branch_name not in _HOLIDAY_OPERATING:
                        clear_cell(cell)
                        continue
                    if fixed_am:
                        set_snack_cell(cell, fixed_am['menu'], fixed_am['nutrition'])
                        continue
                    snack_key = 'afternoon_snack' if use_pm_as_am else 'morning_snack'
                    menu, kcal = build_snack(
                        day.get(snack_key, {}), branch_name, do_strip=do_strip)
                    if not menu:
                        clear_cell(cell)
                        continue
                    set_snack_cell(cell, menu, kcal)

                elif sec == 'pm':
                    menu, kcal = build_snack(
                        day.get('afternoon_snack', {}), branch_name, do_strip=do_strip)
                    if not menu:
                        clear_cell(cell)
                        continue
                    set_snack_cell(cell, menu, kcal)

                elif sec == 'care':
                    menu, kcal = build_snack(
                        day.get('care_snack', {}), branch_name, do_strip=do_strip)
                    set_snack_cell(cell, menu, kcal)


# ════════════════════════════════════════════════════════════════════
# 9-1. 행 높이 고정
# ════════════════════════════════════════════════════════════════════
def _fix_row_heights(table, sections):
    """
    모든 행의 높이를 원본 기준값(EMU)으로 고정.
    5주 × len(sections)행 구조에서 마지막 행만 _H_LAST, 나머지는 섹션별 적용.
    """
    n_rows = len(table.rows)
    n_secs = len(sections)
    for ri in range(n_rows):
        sec = sections[ri % n_secs]
        if ri == n_rows - 1:
            # 전체 테이블의 마지막 행 (5주 마지막 간식 행)
            h = _H_LAST
        elif sec == 'lunch':
            h = _H_LUNCH
        else:
            h = _H_SNACK
        table.rows[ri].height = Emu(h)


# ════════════════════════════════════════════════════════════════════
# 9-2. 텍스트박스 교체
# ════════════════════════════════════════════════════════════════════
_MATERIAL_FIXED_LINE = '키즈밀은 엄선된 친환경 및 국내산 식자재를 선별하여 사용하고, 화학첨가물이 들어있는 가공식품은 최대한 배제하여 올바른 식습관 확립 및 균형 잡힌 영양을 제공합니다.'

_SP_TAG_PML = f'{{{_NS_PML}}}sp'
_P_TAG      = f'{{{_NS_A}}}p'
_T_TAG_A    = f'{{{_NS_A}}}t'
_BODY_PR    = f'{{{_NS_A}}}bodyPr'


def _make_text_paragraph(text, sz=900, bold=False, algn=None):
    """단순 텍스트 paragraph XML 생성."""
    p = etree.Element(_P_TAG)
    if algn:
        pPr = etree.SubElement(p, f'{{{_NS_A}}}pPr')
        pPr.set('algn', algn)
    rPr = etree.Element(f'{{{_NS_A}}}rPr')
    rPr.set('lang', 'ko-KR')
    rPr.set('sz', str(sz))
    if bold:
        rPr.set('b', '1')
    rPr.set('dirty', '0')
    run = etree.SubElement(p, f'{{{_NS_A}}}r')
    run.append(rPr)
    t = etree.SubElement(run, f'{{{_NS_A}}}t')
    t.text = text or ''
    return p


# p:sp 안의 txBody는 p:(PML) 또는 a:(DrawingML) 네임스페이스 둘 다 가능
_TXBODY_TAGS = [f'{{{_NS_PML}}}txBody', f'{{{_NS_A}}}txBody']


def _find_txbody(sp):
    """p:txBody → a:txBody 순으로 탐색."""
    for tag in _TXBODY_TAGS:
        txBody = sp.find(f'.//{tag}')
        if txBody is not None:
            return txBody
    return None


def _replace_textbox_content(slide, search_text, paragraphs, target_name=None):
    spTree = slide.shapes._spTree
    ns_p = 'http://schemas.openxmlformats.org/presentationml/2006/main'

    target_sp = None
    found_by = None

    # 1순위: 이름표(target_name)로 찾기
    if target_name:
        for sp in spTree.findall(f'.//{_SP_TAG_PML}'):
            cNvPr = sp.find(f'.//{{{ns_p}}}cNvPr')
            if cNvPr is not None and cNvPr.get('name') == target_name:
                target_sp = sp
                found_by = 'name'
                break

    # 2순위: 텍스트 키워드로 폴백 (이름표 없는 기존 템플릿 대응)
    if target_sp is None:
        for sp in spTree.findall(f'.//{_SP_TAG_PML}'):
            full_text = ''.join(t.text or '' for t in sp.findall(f'.//{_T_TAG_A}'))
            if search_text in full_text:
                target_sp = sp
                found_by = 'keyword'
                break

    if target_sp is None:
        return

    if target_name:
        print(f"  {target_name} 탐색: {found_by} 방식")

    txBody = _find_txbody(target_sp)
    if txBody is None:
        return
    for p in txBody.findall(_P_TAG):
        txBody.remove(p)
    for para_cfg in paragraphs:
        new_p = _make_text_paragraph(
            para_cfg.get('text', ''),
            sz=para_cfg.get('sz', 900),
            bold=para_cfg.get('bold', False),
            algn=para_cfg.get('algn'),
        )
        txBody.append(new_p)
    return


def replace_origin_text(slide, origin_text):
    """원산지 텍스트박스 교체."""
    if not origin_text:
        return
    _replace_textbox_content(slide, '원산지 표기', [
        {'text': '원산지 표기', 'sz': 1000, 'bold': True, 'algn': 'l'},
        {'text': origin_text.get('body', ''),       'sz': 800},
        {'text': origin_text.get('disclaimer', ''), 'sz': 800},
    ], target_name='ORIGIN_BOX')


def replace_material_text(slide, material_text):
    """원재료 텍스트박스 교체."""
    if not material_text:
        return
    _replace_textbox_content(slide, '원재료 표시안내', [
        {'text': '* 원재료 표시안내 *', 'sz': 900, 'bold': True, 'algn': 'l'},
        {'text': material_text,         'sz': 800},
        {'text': _MATERIAL_FIXED_LINE,  'sz': 800},
    ], target_name='MATERIAL_BOX')


# ════════════════════════════════════════════════════════════════════
# 9-3. 알레르기 박스 동적 배치 + 박스 겹침 감지
# ════════════════════════════════════════════════════════════════════
def _fix_allergy_only(prs):
    """ALLERGY_BOX만 table_bottom 기준 동적 배치. ORIGIN/MATERIAL 위치 불변."""
    ns_p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    ns_a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    SLIDE_HEIGHT = 10680700
    GAP = 30000

    for slide in prs.slides:
        slide_el = slide._element

        # MENU_TABLE 이름표 우선으로 테이블 찾기 (없으면 첫 graphicFrame 폴백)
        table_el, _ = find_shape_smart(slide_el, 'MENU_TABLE', fallback_keyword=None)
        if table_el is None:
            table_el = slide_el.find(f'.//{{{ns_p}}}graphicFrame')
        if table_el is None:
            continue

        # graphicFrame의 xfrm은 PML 네임스페이스 (p:xfrm), off/ext는 DrawingML
        p_xfrm = table_el.find(f'{{{ns_p}}}xfrm')
        tbl = table_el.find(f'.//{{{ns_a}}}tbl')
        if p_xfrm is None or tbl is None:
            continue
        table_top = int(p_xfrm.find(f'{{{ns_a}}}off').get('y'))
        rows = tbl.findall(f'{{{ns_a}}}tr')
        total_row_h = sum(int(tr.get('h', 0)) for tr in rows)
        table_bottom = table_top + total_row_h
        row_count = len(rows)

        if row_count >= 15:
            # 15행: ALLERGY_BOX만 동적 배치, 나머지는 양식 원본 그대로
            sp, found_by = find_shape_smart(slide_el, 'ALLERGY_BOX', fallback_keyword='알레르기 표시')
            if sp is None:
                continue
            xfrm = sp.find(f'.//{{{ns_a}}}xfrm')
            if xfrm is None:
                continue
            off = xfrm.find(f'{{{ns_a}}}off')
            ext = xfrm.find(f'{{{ns_a}}}ext')
            if off is None or ext is None:
                continue
            cy = int(ext.get('cy'))
            new_top = table_bottom + GAP
            if new_top + cy > SLIDE_HEIGHT:
                new_top = SLIDE_HEIGHT - cy - 20000
            off.set('y', str(int(new_top)))
            print(f"  ✅ [15행] ALLERGY_BOX: y={new_top:,} ({found_by})")
            continue

        # 10행: 기존 코드 100% 그대로 (어제 완성본)
        sp, found_by = find_shape_smart(slide_el, 'ALLERGY_BOX', fallback_keyword='알레르기 표시')
        if sp is None:
            continue
        xfrm = sp.find(f'.//{{{ns_a}}}xfrm')
        if xfrm is None:
            continue
        off = xfrm.find(f'{{{ns_a}}}off')
        ext = xfrm.find(f'{{{ns_a}}}ext')
        if off is None or ext is None:
            continue

        cy = int(ext.get('cy'))
        new_top = table_bottom + GAP
        # 슬라이드 하단 초과 방어
        if new_top + cy > SLIDE_HEIGHT:
            new_top = SLIDE_HEIGHT - cy - 20000
        off.set('y', str(int(new_top)))

        # 폰트 7pt → 5pt
        for rPr in sp.findall(f'.//{{{ns_a}}}rPr'):
            szv = rPr.get('sz')
            if szv is None or int(szv) >= 700:
                rPr.set('sz', '500')

        print(f"  ✅ ALLERGY_BOX: y={new_top:,} ({found_by})")

        # ① 원산지/원재료 본문 폰트 6.5pt 축소 (위치 안 건드림)
        ORIGIN_Y = 8_550_000  # 클립보드 기준점 — 아래 클립보드 블록도 이 값 참조
        for box_name in ('ORIGIN_BOX', 'MATERIAL_BOX'):
            bsp, _ = find_shape_smart(slide_el, box_name, fallback_keyword=None)
            if bsp is None:
                continue
            for rPr in bsp.findall(f'.//{{{ns_a}}}rPr'):
                szv = rPr.get('sz')
                if szv is None:
                    rPr.set('sz', '550')
                else:
                    s = int(szv)
                    if s >= 1000:
                        rPr.set('sz', '850')   # 제목 8.5pt 유지
                    elif s >= 600:
                        rPr.set('sz', '550')   # 본문 5.5pt
            # 원산지만 위치 조정 (autofit 유지, y만)
            if box_name == 'ORIGIN_BOX':
                bxfrm = bsp.find(f'.//{{{ns_a}}}xfrm')
                if bxfrm is not None:
                    boff = bxfrm.find(f'{{{ns_a}}}off')
                    if boff is not None:
                        boff.set('y', str(ORIGIN_Y))
            print(f"  ✅ {box_name} 폰트5.5pt" + (" + 위치조정" if box_name == 'ORIGIN_BOX' else ""))

        # ② 키즈밀 로고 축소 + 하단 이동 (pic name='그래픽 118')
        SLIDE_H = 10680700
        LOGO_BOTTOM_MARGIN = 300000  # 슬라이드 하단에서 띄울 여백
        for pic in slide_el.findall(f'.//{{{ns_p}}}pic'):
            c = pic.find(f'.//{{{ns_p}}}cNvPr')
            if c is None or c.get('name') != '그래픽 118':
                continue
            xfrm = pic.find(f'.//{{{ns_a}}}xfrm')
            if xfrm is None:
                continue
            off = xfrm.find(f'{{{ns_a}}}off')
            ext = xfrm.find(f'{{{ns_a}}}ext')
            if off is None or ext is None:
                continue
            ox = int(off.get('x')); oy = int(off.get('y'))
            ocx = int(ext.get('cx')); ocy = int(ext.get('cy'))
            # 80% 축소 (가로세로 비율 유지, 우측 정렬 유지)
            ncx = int(ocx * 0.8); ncy = int(ocy * 0.8)
            right_edge = ox + ocx
            nx = right_edge - ncx        # 우측 끝 맞춤
            ny = SLIDE_H - ncy - LOGO_BOTTOM_MARGIN  # 하단에 붙임
            ext.set('cx', str(ncx)); ext.set('cy', str(ncy))
            off.set('x', str(nx)); off.set('y', str(ny))
            print(f"  ✅ 로고 축소80%+하단이동: y={ny:,} cy={ncy:,}")
            break

        # 식단표 클립보드 아이콘을 5주 본식줄 안으로 (오전줄 침범 방지)
        for pic in slide_el.findall(f'.//{{{ns_p}}}pic'):
            c = pic.find(f'.//{{{ns_p}}}cNvPr')
            if c is None or c.get('name') not in {'그림 3', '그림 224', '그림 193'}:
                continue
            xfrm = pic.find(f'.//{{{ns_a}}}xfrm')
            if xfrm is None:
                continue
            off = xfrm.find(f'{{{ns_a}}}off')
            ext = xfrm.find(f'{{{ns_a}}}ext')
            if off is None or ext is None:
                continue
            ocx = int(ext.get('cx')); ocy = int(ext.get('cy'))
            # 80% 축소
            ncx = int(ocx * 0.8); ncy = int(ocy * 0.8)
            ext.set('cx', str(ncx)); ext.set('cy', str(ncy))
            # 클립보드를 원산지 제목과 나란히 (15행 정답 간격 26,983 적용)
            off.set('y', str(ORIGIN_Y + 26_983))
            print(f"  ✅ 클립보드 아이콘: y={ORIGIN_Y + 26_983:,} (ORIGIN_Y+26,983)")
            break


def _check_box_overlap(prs, branch_label=''):
    """원산지/원재료/알레르기 세 박스가 겹치는지 검사, 겹치면 경고 출력."""
    ns_a = 'http://schemas.openxmlformats.org/drawingml/2006/main'

    def get_rect(slide_el, name):
        sp, _ = find_shape_smart(slide_el, name, fallback_keyword=None)
        if sp is None:
            return None
        xfrm = sp.find(f'.//{{{ns_a}}}xfrm')
        if xfrm is None:
            return None
        off = xfrm.find(f'{{{ns_a}}}off')
        ext = xfrm.find(f'{{{ns_a}}}ext')
        if off is None or ext is None:
            return None
        x  = int(off.get('x'));  y  = int(off.get('y'))
        cx = int(ext.get('cx')); cy = int(ext.get('cy'))
        return (x, y, x + cx, y + cy)

    def overlap(a, b):
        if a is None or b is None:
            return False
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b
        return not (ax2 <= bx1 or bx2 <= ax1 or ay2 <= by1 or by2 <= ay1)

    names = ['ORIGIN_BOX', 'MATERIAL_BOX', 'ALLERGY_BOX']
    for si, slide in enumerate(prs.slides):
        rects = {n: get_rect(slide._element, n) for n in names}
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                if overlap(rects[names[i]], rects[names[j]]):
                    print(f"  ⚠️ 겹침 감지! {branch_label} 슬라이드{si + 1}: {names[i]} ↔ {names[j]}")


# ════════════════════════════════════════════════════════════════════
# 10. 메인 생성 함수
# ════════════════════════════════════════════════════════════════════
def generate(cfg, menu_data, template_path, out_path, date_map=None,
             origin_text=None, material_text=None):
    type_code = cfg['type']
    plan = TYPE_PLANS.get(type_code)
    if plan is None:
        raise ValueError(f'알 수 없는 타입: {type_code}')

    slide_indices = [entry[0] for entry in plan]
    prs           = build_pptx_from_plan(template_path, slide_indices)
    week_days     = _days_by_week(menu_data)
    slides        = list(prs.slides)

    display_name = cfg.get('display_name', cfg['name'])
    email        = cfg.get('email', '')
    if not date_map:
        date_map = {}

    for sidx, plan_entry in enumerate(plan):
        if sidx >= len(slides):
            break
        slide = slides[sidx]

        replace_slide_metadata(slide, display_name, email)
        replace_date_group(slide)  # 날짜 그룹 텍스트 비우기 (날짜는 테이블 셀 안에 삽입)
        replace_origin_text(slide, origin_text)
        replace_material_text(slide, material_text)

        _, sections, opts = plan_entry
        if opts.get('skip') or not sections:
            continue

        table = _get_table(slide)
        if table is None:
            continue

        _render_slide(table, plan_entry, week_days, cfg)

    _fix_allergy_only(prs)
    _check_box_overlap(prs, branch_label=cfg.get('name', out_path))
    prs.save(out_path)
    return out_path
