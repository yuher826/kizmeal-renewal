-- branch_profiles slide_type ENUM 확정
--
-- ※ 이 마이그레이션은 slide_type 컬럼이 이미 존재한다고 가정합니다.
--   컬럼이 없으면 먼저 추가하세요:
--     ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS slide_type text;
--
ALTER TABLE branch_profiles
  DROP CONSTRAINT IF EXISTS branch_profiles_slide_type_check;

ALTER TABLE branch_profiles
  ADD CONSTRAINT branch_profiles_slide_type_check
  CHECK (slide_type IN (
    '1p_standard',
    '2p_split',
    '2p_dual_brand',
    '3p_health_info',
    '4p_bilingual',
    '4p_bilingual_split',
    '4p_allergy_elan'
  ));
