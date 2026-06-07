-- ──────────────────────────────────────────────────────────────
-- B-2: weekly_menus 보강 (CK 식단 웹폼 지원)
-- 실행 순서: Supabase SQL Editor 에서 한 번에 실행
-- ──────────────────────────────────────────────────────────────

-- ── 1. 컬럼 추가 (없는 경우에만) ─────────────────────────────────
ALTER TABLE weekly_menus
  ADD COLUMN IF NOT EXISTS year          integer,
  ADD COLUMN IF NOT EXISTS month         integer,
  ADD COLUMN IF NOT EXISTS branch_id     uuid        REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS diet_type     text        DEFAULT 'CK',
  ADD COLUMN IF NOT EXISTS submitted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by  uuid        REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS month_note    text,
  ADD COLUMN IF NOT EXISTS menu_data     jsonb;

-- ── 2. diet_type NULL → 'CK' 업데이트 (기존 행 있으면) ──────────
UPDATE weekly_menus SET diet_type = 'CK' WHERE diet_type IS NULL;

-- ── 3. diet_type CHECK 제약 ───────────────────────────────────
ALTER TABLE weekly_menus DROP CONSTRAINT IF EXISTS weekly_menus_diet_type_check;
ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_diet_type_check
  CHECK (diet_type IN ('CK', 'consignment'));

-- ── 4. status CHECK 단순화 (draft→submitted→approved→deployed) ──
--    ※ 기존 8단계 CHECK 에서 4단계로 단순화
ALTER TABLE weekly_menus DROP CONSTRAINT IF EXISTS weekly_menus_status_check;
ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'deployed'));

ALTER TABLE weekly_menus ALTER COLUMN status SET DEFAULT 'draft';

-- ── 5. 인덱스 ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weekly_menus_year_month
  ON weekly_menus(year, month, diet_type);

CREATE INDEX IF NOT EXISTS idx_weekly_menus_status
  ON weekly_menus(status);

-- ── 6. CK 공통 식단 부분 유니크 인덱스 ──────────────────────────
--    (branch_id IS NULL 인 CK 식단은 (year, month) 유일)
CREATE UNIQUE INDEX IF NOT EXISTS weekly_menus_ck_unique
  ON weekly_menus(year, month)
  WHERE diet_type = 'CK' AND branch_id IS NULL;

-- ── 결과 확인 ─────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'weekly_menus'
ORDER BY ordinal_position;
