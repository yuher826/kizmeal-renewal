-- diet_templates 트리거 수정 실물 검증 — ✅ 실행 완료 기록 (2026-08-25)
--
-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ ⚠️ 경고 — 이 파일은 "이미 실행이 끝난 검증 절차의 기록"이다.        ║
-- ║                                                                    ║
-- ║ 2~9단계는 프로덕션 diet_templates 테이블에 실제로 INSERT/UPDATE/    ║
-- ║ DELETE 를 수행한다. 무심코 통째로 Run 하지 말 것.                   ║
-- ║ 재실행이 필요한 상황(트리거를 또 손댈 때 등)이 아니면 열어보기만    ║
-- ║ 할 것. 재실행할 경우 반드시 아래 "실행 방법"대로 한 블록씩.         ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- 전제: fix_diet_templates_active_trigger_260824.sql 실행 후 진행.
-- 대상: Supabase 프로젝트 `kizmeal-renewal`
--       (이 계정엔 프로젝트가 2개 있다 — HANDOFF "반복 함정" 항목 참고)
--
-- ── 왜 year=2099 인가 ─────────────────────────────────────────────────
-- 2026-08-24 방학 배정 UI 검증 때 2026-08로 시드했다가, 가짜 manual 행이
-- 프리필 우선순위 1번에 걸려 엉뚱한 서식이 붙을 위험 때문에 전량 삭제한
-- 경험이 있다. 여기서는 실제 파이프라인이 절대 조회하지 않는 좌표
-- (2099년 11·12월)를 썼다. 혹시 삭제를 빠뜨려도 resolve_template_set()이
-- 구체적 year/month로 필터하므로 실운영에 닿지 않는다.
--
-- ── v1 레거시 행 원복 기준값 (2026-08-25 실측) ────────────────────────
--   id               fa242fbd-565d-4fce-8cce-7a3ed49ddf61
--   name             2026년6월식단표폼
--   version          1
--   is_active        true      ← 검증 후 반드시 이 값으로 돌아와야 함
--   year / month     NULL / NULL
--   vacation_variant none
--   group_tag        ALL
--   org_id           NULL
--   created_at       2026-06-03 10:52:11.357858+00
--
-- ── 실행 방법 ─────────────────────────────────────────────────────────
-- 단계별로 "한 블록씩" 실행하고 그때마다 결과를 눈으로 확인할 것.
-- Supabase SQL Editor는 여러 문장을 한 번에 돌리면 마지막 결과만 보여줘서,
-- 통째로 Run 하면 중간 단계를 하나도 못 본다 = 검증의 의미가 없다.


-- ═══════════════════════════════════════════════════════════════
-- 0단계. 함수가 실제로 교체됐는지 확인          [결과: ✅ 전부 true]
--
--   ★pg_get_functiondef() 는 쓰지 말 것 — 결과가 긴 텍스트 한 덩어리라
--     SQL Editor 셀 안에서 잘려서 정작 봐야 할 org_id/search_path 줄이
--     안 보인다(2026-08-25에 실제로 겪음). 아래처럼 조건을 참/거짓으로
--     물어보는 쪽이 확실하다.
-- ═══════════════════════════════════════════════════════════════
SELECT
  p.prosrc LIKE '%org_id%IS NOT DISTINCT FROM%NEW.org_id%'  AS org_id축_있음,
  p.prosrc LIKE '%year%IS NOT DISTINCT FROM%NEW.year%'      AS year축_있음,
  p.prosrc LIKE '%month%IS NOT DISTINCT FROM%NEW.month%'    AS month축_있음,
  p.prosrc LIKE '%vacation_variant = NEW.vacation_variant%' AS variant축_있음,
  p.proconfig                                                AS search_path설정
FROM pg_proc p
WHERE p.proname = 'set_single_active_template';
-- 기대: 앞 4개 전부 true, search_path설정 = ["search_path=public"]
-- 실측: 전부 true / ["search_path=public"]  ✅


-- ═══════════════════════════════════════════════════════════════
-- 1단계. 트리거가 여전히 이 함수를 가리키는지    [결과: ✅ 활성]
--
--   ★tgenabled 는 "char" 타입이라 문자열과 || 로 잇지 말 것
--     (ERROR 42725: operator is not unique). ::text 캐스팅 후 CASE 로 볼 것.
-- ═══════════════════════════════════════════════════════════════
SELECT
  t.tgname          AS 트리거이름,
  p.proname         AS 연결된함수,
  t.tgenabled::text AS 상태코드,
  CASE t.tgenabled::text WHEN 'O' THEN '활성' ELSE '비활성' END AS 상태
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'diet_templates'::regclass
  AND NOT t.tgisinternal;
-- 기대/실측: ensure_single_active_template / set_single_active_template / O / 활성  ✅


-- ═══════════════════════════════════════════════════════════════
-- 2단계. 시작 상태 스냅샷 (마지막에 이것과 대조)  [결과: ✅ 1행]
-- ═══════════════════════════════════════════════════════════════
SELECT id, name, version, is_active, year, month,
       vacation_variant, group_tag, org_id, created_at
  FROM diet_templates
 ORDER BY created_at;
-- 실측: v1 1행, is_active=true, year·month NULL  ✅


-- ═══════════════════════════════════════════════════════════════
-- 3단계. 시나리오 1 — 같은 달 방학O/방학X 동시 active 가능한가
--        ★이번 마이그레이션의 핵심 목적            [결과: ✅ 공존]
-- ═══════════════════════════════════════════════════════════════
INSERT INTO diet_templates (version, name, file_path, is_active, year, month, vacation_variant)
VALUES (9901, '__TEST__2099-12 방학O', '__test__/dummy_on.pptx',  true, 2099, 12, 'vacation_on');

INSERT INTO diet_templates (version, name, file_path, is_active, year, month, vacation_variant)
VALUES (9902, '__TEST__2099-12 방학X', '__test__/dummy_off.pptx', true, 2099, 12, 'vacation_off');

-- 확인 (아래 SELECT는 4~6단계에서도 그대로 재사용)
--   ★ORDER BY 는 version 기준으로 — created_at 정렬은 UPDATE 발생 시 행 순서가
--     흔들려 결과를 대조하기 어렵다(2026-08-25에 실제로 헷갈렸음).
SELECT name, is_active, year, month, vacation_variant
  FROM diet_templates
 ORDER BY version NULLS FIRST, created_at;
-- 기대: 3행 전부 is_active=true (v1도 안 건드려짐)
-- 실측: v1 true / 방학O true / 방학X true  ✅
--       → 수정 전 트리거였다면 서로를 꺼버리고 v1까지 꺼졌을 상황


-- ═══════════════════════════════════════════════════════════════
-- 4단계. 시나리오 2 — 같은 (연,월,variant) 안에서는 여전히 1개만인가
--                                                  [결과: ✅ 방학O만 교체]
-- ═══════════════════════════════════════════════════════════════
INSERT INTO diet_templates (version, name, file_path, is_active, year, month, vacation_variant)
VALUES (9903, '__TEST__2099-12 방학O 신버전', '__test__/dummy_on_v2.pptx', true, 2099, 12, 'vacation_on');

-- (3단계의 확인 SELECT 재실행)
-- 기대/실측: v1 true / 9901 false / 9902 true / 9903 true  ✅
--            방학O만 교체되고 방학X는 무변동


-- ═══════════════════════════════════════════════════════════════
-- 5단계. 시나리오 2-b — UPDATE 경로도 동일한가
--        (트리거가 BEFORE INSERT OR UPDATE 이므로 수정 경로도 봐야 함)
--                                                  [결과: ✅ 동일]
-- ═══════════════════════════════════════════════════════════════
UPDATE diet_templates SET is_active = false WHERE version = 9902;
UPDATE diet_templates SET is_active = true  WHERE version = 9902;

-- (3단계의 확인 SELECT 재실행)
-- 기대/실측: 4단계와 완전히 같은 그림 — 9902 다시 true, 9903 무변동  ✅


-- ═══════════════════════════════════════════════════════════════
-- 6단계. 시나리오 3 — 다른 달끼리 간섭하지 않는가  [결과: ✅ 비간섭]
-- ═══════════════════════════════════════════════════════════════
INSERT INTO diet_templates (version, name, file_path, is_active, year, month, vacation_variant)
VALUES (9904, '__TEST__2099-11 방학O', '__test__/dummy_nov.pptx', true, 2099, 11, 'vacation_on');

-- (3단계의 확인 SELECT 재실행)
-- 기대/실측: 5행. 앞 4행 전부 무변동, 11월 행만 true 로 추가  ✅
--            같은 vacation_on 이어도 달이 다르면 별개 그룹


-- ═══════════════════════════════════════════════════════════════
-- 7단계. 시나리오 4 — 레거시(year/month NULL) 그룹 종전 동작 보존인가
--   ⚠️ 이 단계만 v1의 is_active를 실제로 건드린다. 8단계에서 원복.
--      (v1 활성화는 파이프라인에 영향이 없음이 확인돼 있어 실질 위험 없음)
--                                                  [결과: ✅ 보존]
-- ═══════════════════════════════════════════════════════════════
INSERT INTO diet_templates (version, name, file_path, is_active, year, month, vacation_variant)
VALUES (9905, '__TEST__레거시 스타일', '__test__/dummy_legacy.pptx', true, NULL, NULL, 'none');

-- (3단계의 확인 SELECT 재실행)
-- 기대/실측: v1 false 로 꺼짐(같은 NULL 그룹), 9905 true,
--            2099년 행 4개는 전부 무변동  ✅
--            → IS NOT DISTINCT FROM 이 의도대로 NULL끼리만 묶는다는 실증


-- ═══════════════════════════════════════════════════════════════
-- 8단계. 정리 — 테스트 행 전량 삭제 + v1 원복
--
--   ★순서 주의: 삭제를 먼저, v1 켜기를 나중에.
--     v1을 먼저 켜면 트리거가 '__TEST__레거시 스타일'을 꺼버려 상태가
--     한 번 더 꼬인다.
-- ═══════════════════════════════════════════════════════════════
DELETE FROM diet_templates WHERE name LIKE '\_\_TEST\_\_%';

UPDATE diet_templates
   SET is_active = true
 WHERE id = 'fa242fbd-565d-4fce-8cce-7a3ed49ddf61';


-- ═══════════════════════════════════════════════════════════════
-- 9단계. 원상복구 확인 — 2단계 스냅샷과 완전히 같아야 한다
--                                                  [결과: ✅ 일치]
-- ═══════════════════════════════════════════════════════════════
SELECT id, name, version, is_active, year, month,
       vacation_variant, group_tag, org_id, created_at
  FROM diet_templates
 ORDER BY created_at;
-- 기대/실측: 정확히 1행, 2단계 스냅샷과 전 컬럼 일치  ✅

-- 잔여물 최종 확인 — name 축과 file_path 축 둘 다 본다
--   (한 축만 보고 놓치는 사고를 막기 위해)
SELECT count(*) AS 남은테스트행
  FROM diet_templates
 WHERE name LIKE '\_\_TEST\_\_%'
    OR file_path LIKE '\_\_test\_\_/%';
-- 기대/실측: 0  ✅
