-- diet_review_items에 pdf_url 컬럼 추가
--
-- 배경: app/api/pptx/deploy/route.ts:210에 이미 "diet_review_items에 pdf_url
-- 컬럼 없음 → PDF 형식은 pptx_url로 대체"라는 주석이 있었음. file_format='PDF'
-- 인 원에게 배포 메일을 보내면 버튼엔 "PDF 다운로드"라고 뜨지만 실제 링크는
-- .pptx 파일이 나가는 지뢰 상태였음(2026-08-14 발견, claude.ai 세션).
--
-- jpg_url은 이미 컬럼이 존재함(단, 지금까지 채워 넣는 코드가 없어 항상 NULL —
-- 이번 app_actions.py 수정으로 pdf_url과 함께 실제로 채워지기 시작함).
--
-- weekly_menus.pdf_url은 이미 존재하는 컬럼(과거 설계 시 포함됨) — 여기서는
-- diet_review_items에만 추가하면 됨.

ALTER TABLE diet_review_items
  ADD COLUMN IF NOT EXISTS pdf_url text;

COMMENT ON COLUMN diet_review_items.pdf_url IS
  '식단표 PDF 파일 URL (Supabase Storage). GitHub Actions에서 PPTX 생성 후
   LibreOffice로 변환·업로드. file_format이 PDF 또는 PDF+JPG인 원만 채워짐.';
