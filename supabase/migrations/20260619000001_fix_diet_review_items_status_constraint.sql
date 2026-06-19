-- diet_review_items.review_status 및 weekly_menus.status constraint 수정
-- 배경:
--   1. add_diet_review_items.sql 인라인 CHECK 이름(자동부여)과
--      workflow_v2_full.sql 의 DROP 대상 이름이 달라 구버전 CHECK 잔존.
--      → 'generation_complete' INSERT 시 constraint 위반 발생.
--   2. weekly_menus.status = 'generation_complete' 가 현재 constraint 미포함.
--      → Python upsert_branch_row 에서 RuntimeError 발생.

-- ── 1. diet_review_items.review_status constraint 통합 정리 ──────

-- 인라인 CHECK 자동 이름 패턴 (PostgreSQL)
ALTER TABLE diet_review_items
  DROP CONSTRAINT IF EXISTS diet_review_items_review_status_check;

-- workflow_v2_full.sql 에서 부여한 named constraint
ALTER TABLE diet_review_items
  DROP CONSTRAINT IF EXISTS diet_review_items_status_check;

-- 혹시 남아 있을 수 있는 다른 이름 패턴 대응
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'diet_review_items'::regclass
      AND contype = 'c'
      AND (conname LIKE '%review_status%' OR conname LIKE '%status_check%')
  LOOP
    EXECUTE 'ALTER TABLE diet_review_items DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 현재 코드 기준으로 최종 constraint 재정의
ALTER TABLE diet_review_items
  ADD CONSTRAINT diet_review_items_review_status_check
  CHECK (review_status IN (
    'generation_complete',
    'correction_request',
    'resubmitted',
    'approved',
    'deployed',
    'pending'
  ));

-- 구버전 값 정리 (하위호환)
UPDATE diet_review_items
  SET review_status = 'correction_request'
  WHERE review_status = 'correction_requested';

-- ── 2. weekly_menus.status constraint 에 generation_complete 추가 ─

ALTER TABLE weekly_menus
  DROP CONSTRAINT IF EXISTS weekly_menus_status_check;

ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'approved',
    'deployed',
    'generation_complete',
    'error'
  ));
