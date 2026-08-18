-- 고객사 1:1 문의 카테고리 체계 재정의 (2026-08-18 권팀장 요청)
--
-- 배경: 크레오 온보딩 테스트 후 권팀장 요청사항 1번.
--   "문의형태 선택 후 제목, 내용 자유 기재할 수 있도록"
--   + 문의 유형을 실제 업무 분류에 맞게 재정의
--
-- 변경 내용:
--   최상위 6종: SCHEDULE_OPS(일정/운영), DELIVERY(배송/납품),
--               COMPLAINT(컴플레인), ACCOUNTING(회계), ALLERGY(알러지), OTHER(기타)
--   컴플레인 하위 7종(신규 subcategory 컬럼):
--               MENU, QUANTITY, HYGIENE_SAFETY, DELIVERY,
--               ORDER_SYSTEM, CUSTOMER_SERVICE, ETC
--
--   폐기: MEAL_COUNT(KOS에서 처리), PHOTO(파일보관함으로 이관 예정),
--         CONTRACT(→OTHER 흡수), STAFF_MEAL(별도 분류 불필요),
--         MENU/HYGIENE(→COMPLAINT 하위분류로 흡수), SCHEDULE(→SCHEDULE_OPS)
--
-- 참고: inquiries.category의 CHECK 제약은 inquiry_restructure.sql에서 이미
--       제거된 상태라 카테고리 코드 변경에 DB 제약 문제 없음.

-- 1) 컴플레인 하위분류 컬럼 추가
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS subcategory text;

COMMENT ON COLUMN inquiries.subcategory IS
  '컴플레인 하위분류. category=COMPLAINT일 때만 값이 있고 그 외에는 NULL.
   값: MENU|QUANTITY|HYGIENE_SAFETY|DELIVERY|ORDER_SYSTEM|CUSTOMER_SERVICE|ETC';

-- 2) 기존 데이터 정리
--    2026-08-18 시점 실제 데이터는 테스트 2건(HYGIENE 1, STAFF_MEAL 1)뿐임을
--    조회로 확인함. 운영 데이터가 없으므로 폐기 카테고리를 새 체계로 흡수한다.
--    (행 자체를 지우지 않는 이유: messages/message_attachments가 FK로 물려 있고,
--     데이터 흐름 확인용으로 남겨도 무해하기 때문)
UPDATE inquiries SET category = 'COMPLAINT', subcategory = 'HYGIENE_SAFETY'
  WHERE category = 'HYGIENE';
UPDATE inquiries SET category = 'COMPLAINT', subcategory = 'ETC'
  WHERE category = 'STAFF_MEAL';
UPDATE inquiries SET category = 'COMPLAINT', subcategory = 'MENU'
  WHERE category = 'MENU';
UPDATE inquiries SET category = 'OTHER'
  WHERE category IN ('CONTRACT', 'MEAL_COUNT', 'PHOTO');
UPDATE inquiries SET category = 'SCHEDULE_OPS'
  WHERE category = 'SCHEDULE';

-- 3) 필터·통계용 인덱스
CREATE INDEX IF NOT EXISTS idx_inquiries_subcategory
  ON inquiries(subcategory) WHERE subcategory IS NOT NULL;

-- 4) 확인용 조회 (실행 후 남은 카테고리 분포 점검)
--    기대 결과: 위 6종 코드만 남아있어야 함
-- SELECT category, subcategory, COUNT(*) FROM inquiries
--   GROUP BY category, subcategory ORDER BY COUNT(*) DESC;
