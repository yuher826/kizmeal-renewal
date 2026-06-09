-- PPTX 자동생성 관련 컬럼 추가 + status 제약 확장

-- ── 1. 신규 컬럼 ─────────────────────────────────────────────────
ALTER TABLE weekly_menus
  ADD COLUMN IF NOT EXISTS generation_results JSONB,
  ADD COLUMN IF NOT EXISTS excel_url          TEXT;

-- ── 2. status CHECK 제약 교체 (generating/generated/error 추가) ──
ALTER TABLE weekly_menus
  DROP CONSTRAINT IF EXISTS weekly_menus_status_check;

ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_status_check
  CHECK (status IN (
    'draft',
    'uploaded',
    'generating',
    'generated',
    'review_requested',
    'approved',
    'deployed',
    'error'
  ));
