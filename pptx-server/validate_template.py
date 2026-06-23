# 템플릿 검증 모듈
# 업로드된 PPTX에 이름표 4개 + 표 구조가 올바른지 검사.
# 생성 엔진과 같은 find_shape_by_name을 써서 "검증 통과 = 생성 가능"을 보장.

import zipfile
import io
from lxml import etree
from pptx_generator import find_shape_by_name

NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

REQUIRED_NAMES = ['MENU_TABLE', 'ALLERGY_BOX', 'ORIGIN_BOX', 'MATERIAL_BOX']
EXPECTED_COLS = 6  # 1열(라벨) + 5열(1주~5주). 3장 모두 동일 확인됨.


def _count_table_columns(menu_table_el):
    """MENU_TABLE 도형의 표 컬럼 수 (tblGrid의 gridCol 개수)."""
    grid = menu_table_el.find(f'.//{{{NS_A}}}tblGrid')
    if grid is None:
        return 0
    return len(grid.findall(f'{{{NS_A}}}gridCol'))


def validate_template(pptx_bytes):
    """
    PPTX 바이트를 받아 슬라이드별로 이름표 4개 + 표 구조를 검증.
    반환: {'valid': bool, 'slides': [...], 'summary': str}
    """
    slides_result = []
    overall_valid = True

    with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as z:
        slide_files = sorted(
            n for n in z.namelist()
            if n.startswith('ppt/slides/slide') and n.endswith('.xml')
        )

        if not slide_files:
            return {
                'valid': False,
                'slides': [],
                'summary': '슬라이드를 찾을 수 없습니다 (빈 PPTX).',
            }

        for sf in slide_files:
            root = etree.fromstring(z.read(sf))

            # 1) 이름표 4개 존재 확인 (생성과 동일한 find_shape_by_name)
            names_found = {}
            for name in REQUIRED_NAMES:
                names_found[name] = find_shape_by_name(root, name) is not None
            missing = [n for n, ok in names_found.items() if not ok]

            # 2) 표 구조 호환성 (MENU_TABLE 있을 때만)
            cols = None
            struct_ok = True
            struct_msg = ''
            menu_el = find_shape_by_name(root, 'MENU_TABLE')
            if menu_el is not None:
                cols = _count_table_columns(menu_el)
                if cols != EXPECTED_COLS:
                    struct_ok = False
                    struct_msg = f'표 컬럼이 {cols}개 (예상 {EXPECTED_COLS}개)'

            slide_valid = (len(missing) == 0) and struct_ok
            if not slide_valid:
                overall_valid = False

            slides_result.append({
                'slide': sf.split('/')[-1],
                'valid': slide_valid,
                'names_found': names_found,
                'missing': missing,
                'columns': cols,
                'structure_ok': struct_ok,
                'structure_msg': struct_msg,
            })

    if overall_valid:
        summary = f'검증 통과 — {len(slides_result)}개 슬라이드 모두 이름표 4개 + 표 구조 정상'
    else:
        bad = [s['slide'] for s in slides_result if not s['valid']]
        summary = f'검증 실패 — 문제 슬라이드: {", ".join(bad)}'

    return {
        'valid': overall_valid,
        'slides': slides_result,
        'summary': summary,
    }


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print('사용법: python validate_template.py <pptx파일경로>')
        sys.exit(1)
    with open(sys.argv[1], 'rb') as f:
        result = validate_template(f.read())
    print(result['summary'])
    for s in result['slides']:
        mark = 'O' if s['valid'] else 'X'
        print(f"  [{mark}] {s['slide']}: 누락={s['missing']} 컬럼={s['columns']}")
