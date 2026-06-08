# -*- coding: utf-8 -*-
"""
로컬 단독 테스트 러너 (Step 2-A)
========================================================================
templates/ 에서 8개 PPTX 를 읽어 타입판단 → 텍스트교체 → output/ 저장.
Storage/Next.js 미연결. 순수 로컬 검증.

실행:  python local_test.py

흐름:
  1) bracket_parser 단위테스트 먼저 실행
  2) test_data.json 로드
  3) 8개 원 각각: 템플릿 존재 확인 → generate() → output/ 저장
  4) 원별 성공/스킵/실패 콘솔 출력 + 요약

⚠️ 일본어 금지.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(HERE, "templates")
OUTPUT_DIR = os.path.join(HERE, "output")
DATA_PATH = os.path.join(HERE, "test_data.json")


def _print_header(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def main():
    # ── 1. bracket_parser 단위테스트 ──────────────────────────────────
    _print_header("STEP 1. bracket_parser 단위테스트")
    import bracket_parser
    if not bracket_parser._run_tests():
        print("\n❌ bracket_parser 단위테스트 실패 → 중단")
        return 1

    # ── 2. python-pptx 확인 ──────────────────────────────────────────
    _print_header("STEP 2. 환경 확인")
    try:
        import pptx  # noqa: F401
        print(f"  ✅ python-pptx {pptx.__version__}")
    except ImportError:
        print("  ❌ python-pptx 미설치 → 'pip install -r requirements.txt'")
        return 1

    from pptx_generator import generate

    # ── 3. 데이터 로드 ───────────────────────────────────────────────
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    menu = data["menu"]
    branches = data["branches"]
    print(f"  ✅ test_data.json 로드 ({data['year']}년 {data['month']}월, "
          f"원 {len(branches)}개)")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ── 4. 원별 생성 ─────────────────────────────────────────────────
    _print_header("STEP 3. 원별 PPTX 생성")
    n_ok = 0
    n_skip = 0
    n_fail = 0

    for cfg in branches:
        name = cfg["name"]
        tpl_path = os.path.join(TEMPLATES_DIR, cfg["template"])
        sample = cfg.get("_sample", "")

        if not os.path.exists(tpl_path):
            n_skip += 1
            print(f"  ⏭️  SKIP  {name:8s} (템플릿 없음: {cfg['template']})")
            continue

        out_path = os.path.join(OUTPUT_DIR, f"{name}_생성.pptx")
        try:
            generate(cfg, menu, tpl_path, out_path)
            n_ok += 1
            print(f"  ✅ OK    {name:8s} → output/{name}_생성.pptx  [{sample}]")
        except Exception as e:  # noqa: BLE001
            n_fail += 1
            print(f"  ❌ FAIL  {name:8s} : {type(e).__name__}: {e}")

    # ── 5. 요약 ──────────────────────────────────────────────────────
    _print_header("요약")
    print(f"  성공 {n_ok}  /  스킵 {n_skip}  /  실패 {n_fail}  (전체 {len(branches)})")
    if n_skip:
        print("  ※ 스킵된 원은 templates/ 에 해당 .pptx 를 넣고 다시 실행하세요.")
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
