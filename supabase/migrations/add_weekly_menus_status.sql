-- weekly_menus 확장 마이그레이션
--
-- ※ 주의: weekly_menus.status 컬럼은 이미 존재합니다.
--   (기존 CHECK: 'pending' | 'generated' | 'distributed')
--   ADD COLUMN IF NOT EXISTS 는 기존 컬럼이 있으면 건너뜁니다.
--   → 아래 두 번째 블록(기존 CHECK 교체)을 반드시 별도 실행하세요.
--
-- ── 1단계: 신규 컬럼 추가 ─────────────────────────────────────
ALTER TABLE weekly_menus
  ADD COLUMN IF NOT EXISTS approval_count      integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by         uuid        REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS approved_at         timestamptz,
  ADD COLUMN IF NOT EXISTS deployed_by         uuid        REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS deployed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS deploy_email_sent   boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS deploy_portal_sent  boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS deploy_board_sent   boolean     DEFAULT false;

-- ── 2단계: status 컬럼 CHECK 제약 교체 ───────────────────────
-- (기존 'pending'|'generated'|'distributed' → 새 8단계 상태로 확장)
-- 기존 constraint 이름 확인: \d weekly_menus
-- 기존 이름이 다를 경우 아래 DROP을 맞게 수정하세요.
ALTER TABLE weekly_menus
  DROP CONSTRAINT IF EXISTS weekly_menus_status_check;

ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_status_check
  CHECK (status IN (
    'draft',
    'input_complete',
    'reviewing',
    'correction_requested',
    'approved',
    'generating',
    'generated',
    'deployed'
  ));

-- status 기본값도 'draft'로 변경
ALTER TABLE weekly_menus
  ALTER COLUMN status SET DEFAULT 'draft';

-- ── 인덱스 ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weekly_menus_status
ON weekly_menus(status, year, month);
