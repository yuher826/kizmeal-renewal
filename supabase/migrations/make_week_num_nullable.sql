-- weekly_menus.week_num: NOT NULL 해제 (월별 CK 식단 엑셀 업로드 지원)
-- 기존 per-week 행(branch_id NOT NULL)은 영향 없음
ALTER TABLE weekly_menus ALTER COLUMN week_num DROP NOT NULL;

-- CHECK 제약 업데이트: NULL 허용 + 1~6 범위 유지
ALTER TABLE weekly_menus DROP CONSTRAINT IF EXISTS weekly_menus_week_num_check;
ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_week_num_check
  CHECK (week_num IS NULL OR (week_num BETWEEN 1 AND 6));
