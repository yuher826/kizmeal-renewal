-- diet_templates 활성 템플릿 트리거 범위 축소
-- 초안 2026-08-24 / 검토·보완 2026-08-25 / ★Supabase 실행 완료 2026-08-25
--
-- ✅ 이 파일은 실행 완료된 마이그레이션이다.
--    Supabase 프로젝트 `kizmeal-renewal`에서 2026-08-25 실행했고,
--    같은 폴더 verify_diet_templates_trigger_260825.sql 로 실물 검증까지
--    마쳤다(시나리오 4종 전부 통과, 아래 "검증 결과" 참고).
--
-- ── 배경 ──────────────────────────────────────────────────────────────
-- pptx-server/template_resolver.py의 resolve_template_set()은 "같은
-- (year, month) 안에서 vacation_variant별로 여러 개가 동시에 active"를
-- 전제로 설계돼 있다(방학 있는 달엔 방학O·방학X 템플릿이 동시에 active여야
-- 정상 — HANDOFF 5단계, add_holiday_exceptions_260820.sql 설계 참고).
--
-- 그런데 diet_template_tables.sql이 만든 기존 트리거
-- (ensure_single_active_template → set_single_active_template())는
-- "테이블 전체에서 무조건 1개만 active"를 강제했다:
--   UPDATE diet_templates SET is_active = false WHERE id != NEW.id;
-- 방학O 템플릿을 활성화하면 같은 달의 방학X 템플릿까지 자동으로 꺼졌다.
-- 이걸 안 고치면 2026-08-24에 만든 방학 O/X 배정 UI가 실제 운영에서
-- 쓸모가 없었다(양쪽 템플릿이 공존을 못 하므로).
--
-- ── 함께 발견된 사실(이 마이그레이션과 별개, 참고용) ────────────────────
-- 현재 유일한 실템플릿(v1 '2026년6월식단표폼')은 year·month가 NULL이라
-- resolve_template_set()의 구체적 year/month 필터에 애초에 안 걸린다.
-- 즉 지금 "활성화" 버튼은 실제 PPTX 생성에 아무 영향이 없다(로컬 6월
-- 폴백만 계속 사용됨). 이 마이그레이션은 그 문제를 고치지 않는다 —
-- 레거시 v1은 그대로 두고 화면에 "레거시(효과없음)" 라벨만 붙이기로
-- 확정(유대표 결정 2026-08-24). 삭제 여부는 판단하지 않는다.
--
-- ── 실행 전 스키마 확인 결과 (2026-08-25) ──────────────────────────────
-- diet_templates 컬럼 15개를 information_schema로 직접 대조했다.
-- 이 파일이 참조하는 컬럼의 실제 정의:
--   year             integer  NULL 허용
--   month            integer  NULL 허용
--   vacation_variant text     NOT NULL (DEFAULT 'none')
--   org_id           uuid     NULL 허용  (실행 시점 전 행 NULL)
--
-- ⚠️ ★year/month/group_tag/validation_result/org_id 5개 컬럼은 레포 어느
--    마이그레이션 파일에도 ADD COLUMN 기록이 없다(원본 diet_template_tables.sql
--    은 9개 컬럼뿐, add_holiday_exceptions_260820.sql은 vacation_variant만
--    추가). DB엔 실재하나 DDL 이력이 유실된 상태다.
--    → 이 테이블 스키마를 레포만 보고 판단하지 말 것. 반드시 DB를 조회할 것.
--
-- ── 수정 내용 ─────────────────────────────────────────────────────────
-- "같은 (org_id, year, month, vacation_variant) 조합 안에서만 단일 active"
-- 로 좁힌다.
--
--   [1] IS NOT DISTINCT FROM 을 쓰는 이유 — year/month가 둘 다 NULL인
--       레거시 행끼리는 일반 `=` 비교가 NULL이 되어(never true) 서로 다른
--       그룹으로 빠져나간다. NOT DISTINCT FROM은 NULL=NULL을 true로
--       취급하므로, 레거시 행들끼리는 종전과 동일하게 "통틀어 1개만
--       active"가 유지되고, year/month가 실제로 채워진 새 행들은 그 값
--       기준으로 정확히 묶인다.
--
--   [2] vacation_variant는 NOT NULL DEFAULT 'none' 제약이 있어 NULL이 될
--       수 없으므로 일반 `=` 비교로 충분하다.
--
--   [3] ★org_id 축 — 2026-08-25 검토에서 신설(초안엔 없었음). 멀티테넌시
--       대비 컬럼인데 트리거가 무시하고 있어서, 조직이 2개 이상 되는 순간
--       "A조직이 2026-08 방학O를 활성화하면 B조직의 2026-08 방학O까지 같이
--       꺼지는" 사고가 난다. 재현이 어려운 종류의 버그라 지금 한 줄로 막았다.
--       실행 시점에 전 행이 org_id IS NULL 이므로 이 축을 추가해도 당시
--       동작은 종전과 완전히 동일했다(NULL IS NOT DISTINCT FROM NULL → true).
--       org_id도 NULL 허용이라 IS NOT DISTINCT FROM 을 쓴다.
--
--   [4] search_path 고정 — 기존 함수엔 없었다. Supabase 린터가
--       function_search_path_mutable 로 잡는 항목이라 함수 본문을 갈아끼우는
--       김에 함께 해결했다.
--
-- ── 이번 범위에 넣지 않은 것 ──────────────────────────────────────────
-- ⚠️ group_tag(원 계열별 템플릿) 축은 일부러 뺐다. resolve_template_set()이
--    아직 이 컬럼을 안 읽는 dead column이라(향후 확장용으로 추정) 지금
--    축에 넣으면 트리거가 실제 소비 로직보다 앞서가 오히려 어긋난다.
--    ★ 나중에 group_tag를 실제로 살릴 때는 이 트리거도 반드시 함께
--      고쳐야 한다. 안 그러면 계열별 템플릿이 서로를 꺼버린다.
--
-- ⚠️ 기존에 이미 여러 행이 active인 상태를 정리하는 백필은 없다. 트리거는
--    "새로 활성화되는 행"만 처리한다. 실행 시점 실템플릿이 v1 1건뿐이라
--    문제되지 않았다.
--
-- ⚠️ UPDATE 조건에 `AND is_active = true`(이미 false인 행은 건드리지 않기)를
--    넣을지 검토했으나 **의도적으로 넣지 않았다.** is_active가 nullable이라
--    NULL 행의 처리가 종전과 미묘하게 달라지고, 행 수가 십수 개 수준이라
--    쓰기 절감 이득도 없다. 이번 변경의 표면적을 최소로 유지하는 쪽을 택했다.
--
-- ── ★검증 결과 (2026-08-25, 실물) ─────────────────────────────────────
-- verify_diet_templates_trigger_260825.sql 로 2099년 샌드박스에서 전 시나리오
-- 실행. 화면 표시값과 DB 저장값을 매 단계 대조했다.
--   1) 같은 달 방학O·방학X 동시 active          → ✅ 공존 확인(핵심 목적 달성)
--   2) 같은 (연,월,variant) 안에서는 단일 active → ✅ 방학O만 교체, 방학X 무변동
--   3) UPDATE 경로도 INSERT와 동일               → ✅ 껐다 켜도 옆 variant 무변동
--   4) 다른 달끼리 비간섭                        → ✅ 2099-11이 2099-12 무변동
--   5) 레거시(year/month NULL) 그룹 종전 동작     → ✅ NULL끼리만 통틀어 1개
--   6) 원상복구                                  → ✅ 스냅샷 일치, 잔여 테스트행 0
--
-- 함수 본문만 바뀌고 트리거 자체(이름·타이밍·대상 테이블)는 그대로이므로
-- CREATE TRIGGER를 다시 걸지 않았다(CREATE OR REPLACE FUNCTION이 함수 OID를
-- 유지하므로 기존 트리거가 그대로 새 본문을 가리킨다 — 실행 후 pg_trigger
-- 조회로 확인함: ensure_single_active_template / tgenabled='O' / 연결 정상).

CREATE OR REPLACE FUNCTION set_single_active_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE diet_templates
       SET is_active = false
     WHERE id != NEW.id
       AND org_id           IS NOT DISTINCT FROM NEW.org_id
       AND year             IS NOT DISTINCT FROM NEW.year
       AND month            IS NOT DISTINCT FROM NEW.month
       AND vacation_variant = NEW.vacation_variant;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = public;

COMMENT ON FUNCTION set_single_active_template() IS
  '같은 (org_id, year, month, vacation_variant) 조합 안에서만 단일 active를 강제한다. '
  '2026-08-24 이전엔 테이블 전체에서 1개만 허용해 방학O/X 동시 active가 불가능했다. '
  'group_tag는 아직 resolve_template_set()이 안 읽는 dead column이라 축에서 제외 — '
  '향후 계열별 템플릿을 살릴 때 이 함수도 함께 수정할 것.';


-- ── 되돌리기 (원복이 필요할 때만 아래 블록을 실행) ─────────────────────
-- 아래는 2026-08-25 이전의 원래 동작(테이블 전체 단일 active)이다.
--
-- CREATE OR REPLACE FUNCTION set_single_active_template()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.is_active = true THEN
--     UPDATE diet_templates
--     SET is_active = false
--     WHERE id != NEW.id;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- ⚠️ 되돌리면 방학 O/X 동시 active가 다시 불가능해진다. 즉 방학 배정 UI가
--    다시 무력화된다는 뜻이므로, 원복은 "새 트리거가 예상 밖 문제를 일으켜
--    긴급 차단이 필요할 때"만.
