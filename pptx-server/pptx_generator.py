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
import zipfile

from lxml import etree
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

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


def set_lunch_cell(cell, lines):
    """
    중식 셀: run-br-run-br-... 구조에서 각 run에 라인별 텍스트 주입.
    lines: [밥, 국, 반찬1, ..., 영양구성] (최대 7개)
    """
    _, runs = _get_p_and_runs(cell)
    if not runs:
        return
    for i, run in enumerate(runs):
        text = lines[i] if i < len(lines) else ''
        menu, allergy = split_menu_allergy(text)
        _set_run_text(run, menu)
        if allergy:
            allergy_run = _make_allergy_run(run, allergy)
            p = run.getparent()           # run 자체에서 부모 <a:p> 직접 획득 (안전)
            run_idx = list(p).index(run)
            p.insert(run_idx + 1, allergy_run)


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
    _, runs = _get_p_and_runs(cell)
    for run in runs:
        _set_run_text(run, '')


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


def replace_date_group(slide, date_map):
    _DATE_GROUP_NAMES = {'그룹 25', '그룹 1', '그룹 201'}
    for shape in slide.shapes:
        if shape.name in _DATE_GROUP_NAMES:
            _replace_date_in_group(shape, date_map)
            break


def _replace_date_in_group(group_shape, date_map):
    try:
        for shape in group_shape.shapes:
            if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                try:
                    for inner in shape.shapes:
                        if inner.has_text_frame:
                            txt = inner.text_frame.text.strip()
                            if txt in date_map:
                                for para in inner.text_frame.paragraphs:
                                    for run in para.runs:
                                        if run.text.strip() in date_map:
                                            run.text = run.text.replace(
                                                run.text.strip(), date_map[txt])
                except Exception:
                    pass
            elif shape.has_text_frame:
                txt = shape.text_frame.text.strip()
                if txt in date_map:
                    for para in shape.text_frame.paragraphs:
                        for run in para.runs:
                            if run.text.strip() in date_map:
                                run.text = run.text.replace(
                                    run.text.strip(), date_map[txt])
    except Exception:
        pass


# ════════════════════════════════════════════════════════════════════
# 8. 표 헬퍼
# ════════════════════════════════════════════════════════════════════
def _get_table(slide):
    for shape in slide.shapes:
        if shape.has_table:
            return shape.table
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
                    if day.get('is_holiday'):
                        clear_cell(cell)
                        continue
                    lines = build_lunch_lines(
                        day.get('lunch', {}), branch_name,
                        do_strip=do_strip,
                        add_fruit=add_fruit,
                        fruit_text=fruit_text,
                    )
                    set_lunch_cell(cell, lines)

                elif sec == 'am':
                    if fixed_am:
                        set_snack_cell(cell, fixed_am['menu'], fixed_am['nutrition'])
                        continue
                    snack_key = 'afternoon_snack' if use_pm_as_am else 'morning_snack'
                    menu, kcal = build_snack(
                        day.get(snack_key, {}), branch_name, do_strip=do_strip)
                    set_snack_cell(cell, menu, kcal)

                elif sec == 'pm':
                    menu, kcal = build_snack(
                        day.get('afternoon_snack', {}), branch_name, do_strip=do_strip)
                    set_snack_cell(cell, menu, kcal)

                elif sec == 'care':
                    menu, kcal = build_snack(
                        day.get('care_snack', {}), branch_name, do_strip=do_strip)
                    set_snack_cell(cell, menu, kcal)


# ════════════════════════════════════════════════════════════════════
# 10. 메인 생성 함수
# ════════════════════════════════════════════════════════════════════
def generate(cfg, menu_data, template_path, out_path, date_map=None):
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
        if date_map:
            replace_date_group(slide, date_map)

        _, sections, opts = plan_entry
        if opts.get('skip') or not sections:
            continue

        table = _get_table(slide)
        if table is None:
            continue

        _render_slide(table, plan_entry, week_days, cfg)

    prs.save(out_path)
    return out_path
