-- diet_templates: year/month 반쪽 채움 방어
-- ✅ Supabase 실행 완료 2026-08-25 (프로젝트 `kizmeal-renewal`)
--
-- 트리거 수정(fix_diet_templates_active_trigger_260824.sql)과는 관심사가
-- 달라 파일과 커밋을 분리했다. 실행은 같은 날 이어서 했다.
--
-- ── 배경 ──────────────────────────────────────────────────────────────
-- 새 템플릿 모델에서 year·month는 "둘 다 채워지거나(신규) 둘 다 NULL이거나
-- (레거시 v1)" 두 가지만 정상이다. 한쪽만 채워진 행은:
--   1) resolve_template_set()의 filters={'year':y,'month':m} 에 안 걸려
--      실제 생성에서 조용히 무시되고,
--   2) 트리거 그룹 판정에서도 NULL 쪽이 다른 NULL 행들과 한 덩어리로
--      묶여 엉뚱한 행을 꺼버릴 수 있다.
-- 화면엔 "활성"으로 보이는데 파이프라인은 안 쓰는, 추적이 어려운 상태다.
--
-- ★이 프로젝트에서 이미 같은 유형의 실패를 겪었다 — v1의 year/month가
--   NULL이라 "활성화 버튼이 아무 효과가 없던" 사실을 2026-08-24에야
--   발견했다. 몇 달간 아무도 몰랐던 이유는 DB가 아무 말도 안 해줬기
--   때문이다. 반쪽 채움도 정확히 같은 방식으로 조용히 실패한다.
--
-- ── 왜 지금(업로드 폼 작업 전에) 넣었는가 ──────────────────────────────
-- 다음 작업인 "템플릿 업로드 폼에 연/월 선택 추가"가 year/month를 채우는
-- 첫 코드다. 즉 반쪽 채움이 실제로 발생할 수 있는 최초 시점이 그때다.
-- 방어물은 사고보다 먼저 서 있어야 의미가 있으므로 코드 작업 전에 걸었다.
-- 실행 시점 테이블에 행이 1개뿐이라(그것도 NULL/NULL) 가장 싼 타이밍이기도 했다.
--
-- ── 실행 전 확인 (2026-08-25 실측) ────────────────────────────────────
--   SELECT count(*) AS 전체행,
--          count(*) FILTER (WHERE (year IS NULL) <> (month IS NULL)) AS 위반행
--     FROM diet_templates;
--   → 전체행 1 / 위반행 0  ✅
--   ※ 위반행만 보면 "테이블이 비어서 0"인 경우와 구분이 안 되므로
--     전체행을 함께 본다.

ALTER TABLE diet_templates
  ADD CONSTRAINT diet_templates_year_month_pair
  CHECK ((year IS NULL) = (month IS NULL));

COMMENT ON CONSTRAINT diet_templates_year_month_pair ON diet_templates IS
  'year/month는 둘 다 채워지거나(신규 모델) 둘 다 NULL(레거시)이어야 한다. '
  '한쪽만 채워지면 resolve_template_set() 필터에 안 걸려 조용히 무시된다.';


-- ── ★실행 후 검증 (2026-08-25, 실물) ──────────────────────────────────
--
-- (1) 제약이 실제로 걸렸는지
--
--   SELECT conname AS 제약이름, pg_get_constraintdef(oid) AS 정의
--     FROM pg_constraint
--    WHERE conrelid = 'diet_templates'::regclass AND contype = 'c';
--
--   실측: 3건 조회됨  ✅
--     diet_templates_group_tag_check          (기존)
--     diet_templates_vacation_variant_check   (기존, 260820)
--     diet_templates_year_month_pair          CHECK (((year IS NULL) = (month IS NULL)))
--
-- (2) ★제약이 실제로 "막아주는지" — 존재 확인만으론 부족하다
--
--   INSERT INTO diet_templates (version, name, file_path, is_active, year, month, vacation_variant)
--   VALUES (9906, '__TEST__반쪽채움', '__test__/dummy_half.pptx', false, 2099, NULL, 'none');
--
--   ★이 INSERT는 "거부되는 것"이 성공이다.
--   실측: ERROR 23514 — new row for relation "diet_templates" violates
--         check constraint "diet_templates_year_month_pair"  ✅
--   거부되면 행이 아예 안 들어가므로 정리할 것도 없다.
--   (만에 하나 통과해도 다른 행을 건드리지 않도록 is_active=false 로 시도했다)


-- ── 되돌리기 ──────────────────────────────────────────────────────────
-- ALTER TABLE diet_templates DROP CONSTRAINT diet_templates_year_month_pair;
