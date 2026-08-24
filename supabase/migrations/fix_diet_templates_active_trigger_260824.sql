-- diet_templates 활성 템플릿 트리거 범위 축소 (2026-08-24, 초안 — 실행 전)
--
-- ⚠️ 이 파일은 초안이다. 유대표 확인 후 Supabase SQL Editor에서 실행할 것.
--    실행 전까지 "→ Supabase에서 실행 완료" 문구를 HANDOFF에 붙이지 말 것
--    (이 프로젝트의 기존 관례 — 레포에 있다 ≠ DB에 반영됐다).
--
-- ── 배경 ──────────────────────────────────────────────────────────────
-- pptx-server/template_resolver.py의 resolve_template_set()은 "같은
-- (year, month) 안에서 vacation_variant별로 여러 개가 동시에 active"를
-- 전제로 설계돼 있다(방학 있는 달엔 방학O·방학X 템플릿이 동시에 active여야
-- 정상 — HANDOFF 5단계, add_holiday_exceptions_260820.sql 설계 참고).
--
-- 그런데 diet_template_tables.sql이 만든 기존 트리거
-- (ensure_single_active_template → set_single_active_template())는
-- "테이블 전체에서 무조건 1개만 active"를 강제한다:
--   UPDATE diet_templates SET is_active = false WHERE id != NEW.id;
-- 방학O 템플릿을 활성화하면 같은 달의 방학X 템플릿까지 자동으로 꺼진다.
-- 새 모델과 정면 충돌 — 이걸 안 고치면 오늘 만든 방학 O/X 배정 UI가 실제
-- 운영에서 쓸모가 없다(양쪽 템플릿이 공존을 못 하므로).
--
-- ── 함께 발견된 사실(이 마이그레이션과 별개, 참고용) ────────────────────
-- 현재 유일한 실템플릿(v1 '2026년6월식단표폼')은 year·month가 NULL이라
-- resolve_template_set()의 구체적 year/month 필터에 애초에 안 걸린다.
-- 즉 지금 "활성화" 버튼은 실제 PPTX 생성에 아무 영향이 없다(로컬 6월
-- 폴백만 계속 사용됨). 이 마이그레이션은 그 문제를 고치지 않는다 —
-- 레거시 v1은 그대로 두고 화면에 "레거시(효과없음)" 라벨만 붙이기로
-- 확정(유대표 결정 2026-08-24). 삭제 여부는 판단하지 않는다.
--
-- ── 수정 내용 ─────────────────────────────────────────────────────────
-- "같은 (year, month, vacation_variant) 조합 안에서만 단일 active"로 좁힌다.
--
--   IS NOT DISTINCT FROM 을 쓰는 이유 — year/month가 둘 다 NULL인 레거시
--   행끼리는 일반 `=` 비교가 NULL이 되어(never true) 서로 다른 그룹으로
--   빠져나간다. NOT DISTINCT FROM은 NULL=NULL을 true로 취급하므로,
--   레거시 행들끼리는 종전과 동일하게 "통틀어 1개만 active"가 유지되고,
--   year/month가 실제로 채워진 새 행들은 그 값 기준으로 정확히 묶인다.
--
--   vacation_variant는 NOT NULL DEFAULT 'none' 제약이 있어 NULL이 될 수
--   없으므로 일반 `=` 비교로 충분하다.
--
-- 검증 시나리오(코드 리뷰로 확인, 실행 후 재확인 필요):
--   1) 2026-08 vacation_on 신규 활성화 → 같은 (2026,8,vacation_on) 행만
--      비활성화됨. 같은 달 vacation_off 행은 안 건드림 → 공존 확인
--   2) 2026-08 vacation_off 신규 활성화 → vacation_on은 그대로 둔 채
--      vacation_off끼리만 갱신
--   3) 레거시 스타일 신규 행(year=null, variant='none') 활성화 → 기존
--      레거시 활성 행(v1)만 비활성화, year/month 채워진 행들은 안 건드림
--      → 기존 "레거시는 통틀어 1개" 동작 그대로 보존
--
-- 함수 본문만 바뀌고 트리거 자체(이름·타이밍·대상 테이블)는 그대로이므로
-- CREATE TRIGGER를 다시 걸 필요는 없다(CREATE OR REPLACE FUNCTION으로 충분).

CREATE OR REPLACE FUNCTION set_single_active_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE diet_templates
       SET is_active = false
     WHERE id != NEW.id
       AND year             IS NOT DISTINCT FROM NEW.year
       AND month            IS NOT DISTINCT FROM NEW.month
       AND vacation_variant = NEW.vacation_variant;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_single_active_template() IS
  '같은 (year, month, vacation_variant) 조합 안에서만 단일 active를 강제한다. '
  '2026-08-24 이전엔 테이블 전체에서 1개만 허용해 방학O/X 동시 active가 불가능했다.';
