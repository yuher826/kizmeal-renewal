import zipfile, shutil, os
import xml.etree.ElementTree as ET

TEMPLATE = os.path.join('pptx-server', 'templates', '2026년 6월 식단표(양식).pptx')
ns_p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
ns_a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
ET.register_namespace('', ns_p)
ET.register_namespace('a', ns_a)
ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

# 백업
backup = TEMPLATE + '.bak'
if not os.path.exists(backup):
    shutil.copy(TEMPLATE, backup)
    print(f"백업 생성: {backup}")

# 작업 폴더에 압축 해제
work = 'pptx-server/_tpl_work'
if os.path.exists(work): shutil.rmtree(work)
os.makedirs(work)
with zipfile.ZipFile(TEMPLATE) as z:
    z.extractall(work)

# 슬라이드 파일 목록
slides_dir = os.path.join(work, 'ppt', 'slides')
slide_files = sorted([f for f in os.listdir(slides_dir) if f.startswith('slide') and f.endswith('.xml')])
print(f"슬라이드 {len(slide_files)}장 발견")

total = 0
for sf in slide_files:
    path = os.path.join(slides_dir, sf)
    tree = ET.parse(path)
    root = tree.getroot()
    applied = []

    # 테이블 → MENU_TABLE
    gf = root.find(f'.//{{{ns_p}}}graphicFrame')
    if gf is not None:
        gf.find(f'.//{{{ns_p}}}cNvPr').set('name', 'MENU_TABLE')
        applied.append('MENU_TABLE')

    # 원산지/원재료
    for sp in root.findall(f'.//{{{ns_p}}}sp'):
        texts = ''.join(t.text or '' for t in sp.findall(f'.//{{{ns_a}}}t'))
        cNvPr = sp.find(f'.//{{{ns_p}}}cNvPr')
        if '원산지 표기' in texts:
            cNvPr.set('name', 'ORIGIN_BOX'); applied.append('ORIGIN_BOX')
        elif '원재료' in texts and '표시안내' in texts:
            cNvPr.set('name', 'MATERIAL_BOX'); applied.append('MATERIAL_BOX')

    # 알레르기 (sp)
    for sp in root.findall(f'.//{{{ns_p}}}sp'):
        texts = ''.join(t.text or '' for t in sp.findall(f'.//{{{ns_a}}}t'))
        if '알레르기 표시' in texts:
            sp.find(f'.//{{{ns_p}}}cNvPr').set('name', 'ALLERGY_BOX')
            applied.append('ALLERGY_BOX')
            break

    tree.write(path, xml_declaration=True, encoding='UTF-8')
    total += len(applied)
    print(f"  {sf}: {applied}")

# 다시 압축 (원본 파일명 그대로)
if os.path.exists(TEMPLATE): os.remove(TEMPLATE)
with zipfile.ZipFile(TEMPLATE, 'w', zipfile.ZIP_DEFLATED) as z:
    for rootdir, _, files in os.walk(work):
        for file in files:
            fp = os.path.join(rootdir, file)
            arc = os.path.relpath(fp, work)
            z.write(fp, arc)

shutil.rmtree(work)
print(f"\n총 {total}개 이름표 부여 완료 → {TEMPLATE}")
