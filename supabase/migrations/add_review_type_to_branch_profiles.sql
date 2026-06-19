-- branch_profiles 테이블에 review_type 컬럼 추가
--
-- 목적: 검토 페이지에서 일반 업장(standard)과 특이 업장(special)을 구분하여
--       이원화 검토 UI를 지원한다.
--
-- 특이 업장(special) 판별 기준:
--   is_elan = true       : 엘란 전용 4버전 생성 (PPTX+PDF × 알레르기 유무)
--   is_ingpa = true      : [잉파X] 규칙 적용 업장
--   direct_delivery=true : 이메일 미발송, 담당자 직접 전달 업장 (예: 목동 계열 직납)
--   file_format 비표준    : PDF 등 비표준 포맷 업장 (예: 덕양P)
--
-- 위탁 업장 처리:
--   로티스·송파MB·KIS → VALID_BRANCHES 미포함, diet_review_items 미생성 → 제외
--   잉파 → is_ingpa = true 로 포함되나,
--           review_required = false 이면 검토 흐름 미진입 → 조건으로 제외
--
-- 코드 내 변수명 규약:
--   branch_profiles.review_type → branchReviewType (review_status 와 혼동 금지)

BEGIN;

-- 1. review_type 컬럼 추가 (DEFAULT 'standard' 로 기존 데이터 안전 처리)
ALTER TABLE branch_profiles
  ADD COLUMN IF NOT EXISTS review_type text DEFAULT 'standard';

-- 2. 기존 NULL 행 정리
UPDATE branch_profiles
SET review_type = 'standard'
WHERE review_type IS NULL;

-- 3. NOT NULL 제약 추가
ALTER TABLE branch_profiles
  ALTER COLUMN review_type SET NOT NULL;

-- 4. CHECK constraint (재실행 안전)
ALTER TABLE branch_profiles
  DROP CONSTRAINT IF EXISTS branch_profiles_review_type_check;
ALTER TABLE branch_profiles
  ADD CONSTRAINT branch_profiles_review_type_check
  CHECK (review_type IN ('standard', 'special'));

-- 5. 특이 업장 지정
--    조건:
--      (is_elan·is_ingpa·direct_delivery·비표준 포맷) 중 하나 이상 해당
--      AND (위탁이 아니거나, 위탁이더라도 review_required = true 인 경우)
UPDATE branch_profiles
SET review_type = 'special'
WHERE (
    is_elan = true
    OR is_ingpa = true
    OR direct_delivery = true
    OR (file_format IS NOT NULL AND UPPER(file_format) NOT IN ('PPTX', 'PPT'))
  )
  AND (diet_type != 'consignment' OR review_required = true);

COMMIT;

-- [실행 후 검증 — 아래 SELECT 결과 공유해주시면 STEP 2 진행합니다]
SELECT
  short_code,
  branch_full_name,
  review_type,
  is_elan,
  is_ingpa,
  direct_delivery,
  file_format,
  diet_type,
  review_required,
  sort_order
FROM branch_profiles
ORDER BY review_type DESC, sort_order NULLS LAST;
