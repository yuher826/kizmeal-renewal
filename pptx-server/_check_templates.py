import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_template import validate_template

tpl_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
files = sorted(f for f in os.listdir(tpl_dir) if f.endswith('.pptx'))
print(f'총 {len(files)}개 파일 검사')
print('=' * 50)
for fname in files:
    fpath = os.path.join(tpl_dir, fname)
    with open(fpath, 'rb') as f:
        result = validate_template(f.read())
    status = 'PASS' if result.get('valid') else 'FAIL'
    print(f'[{status}] {fname}')
    for s in result.get('slides', []):
        miss = s.get('missing', [])
        if miss:
            print(f'    {s.get("slide","?")}: 누락 {miss}')
print('=' * 50)
