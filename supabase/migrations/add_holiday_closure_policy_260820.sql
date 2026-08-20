-- 공휴일 2단 필터 — 공휴일 자체의 기본 정책 컬럼 (2026-08-20)
--
-- 선행: add_holiday_exceptions_260820.sql (public_holidays 테이블 신설)
--
-- 배경: 특일정보 API가 주는 isHoliday='Y'가 곧 "어린이집이 쉰다"는 뜻이 아니다.
--   2026년 실측 22건 안에 **노동절(5/1)·제헌절(7/17)** 처럼 원이 정상운영하는
--   날이 섞여 있다. 이 22건을 매달 원별로 확인시키면 "확인만 하면 되는" UX
--   목표가 깨진다(유대표 지적).
--
-- ★2단 필터 (유대표 승인 2026-08-20)
--   1단계: 공휴일 자체를 "전 원 휴무 / 전 원 정상운영"으로 먼저 분류.
--          한 번 정하면 유지된다.
--   2단계: '전 원 휴무'로 남은 날만 원별 예외를 확인한다.
--   이 컬럼이 1단계의 저장소다. 2단계 결과는 branch_holiday_operations.
--
-- ★NOT NULL DEFAULT를 붙이지 않는다 — 어느 쪽으로 기본값을 줘도 사고가 난다.
--     'all_closed'    기본 → 노동절이 자동 휴무 처리되어
--                            **원은 정상운영하는데 식단표에 메뉴가 없다**
--     'all_operating' 기본 → 설날에 메뉴가 들어간다
--   NULL = 미분류로 두면 "아직 안 정했다"가 명시적이 되고, 팝업이 반드시
--   묻도록 강제된다. "코드가 추측하지 말고 사람이 표시 → 코드가 읽는다"는
--   이 프로젝트의 기존 원칙(gen_form.py --holiday 설계와 동일)과도 맞는다.
--
-- ★"한 번 정하면 유지"는 별도 테이블 없이 **이름 기준 조회**로 해결한다.
--     SELECT closure_policy FROM public_holidays
--      WHERE name = '광복절' AND closure_policy IS NOT NULL
--        AND holiday_date < $1
--      ORDER BY holiday_date DESC LIMIT 1;
--   같은 쿼리가 팝업의 "작년 동일 공휴일엔 이렇게 하셨습니다" 표시도
--   그대로 해결하므로 테이블을 하나 아낀다. 아래 인덱스가 이 쿼리용.
--
--   ⚠️ 이름 매칭의 한계 — 설날·추석·광복절·'대체공휴일(광복절)'처럼 이름이
--     안정적인 공휴일은 승계가 잘 되지만, 선거는 매년 이름이 달라서
--     ('제9회 전국동시지방선거') 승계되지 않는다. 일회성 공휴일은 어차피
--     사람이 판단해야 하므로 의도된 동작이다.
--
-- 참고: 이 시점에 public_holidays는 비어 있다(수집 API 미실행). 백필 불필요.

ALTER TABLE public_holidays
  ADD COLUMN IF NOT EXISTS closure_policy text
    CHECK (closure_policy IN ('all_closed', 'all_operating'));

COMMENT ON COLUMN public_holidays.closure_policy IS
  'all_closed=전 원 휴무 기본(2단계 원별 확인 대상) / '
  'all_operating=전 원 정상운영(원별 확인 생략) / NULL=미분류(팝업이 물어봐야 함)';

-- 전년도 동일 공휴일 정책 승계 + "작년엔 이렇게 하셨습니다" 조회용.
-- (name, holiday_date DESC) 순서 — 이름으로 좁힌 뒤 최신 건을 바로 집는다
CREATE INDEX IF NOT EXISTS idx_public_holidays_name_date
  ON public_holidays(name, holiday_date DESC);

-- 미분류 공휴일 조회용. diff에 변화가 없어도 미분류가 남아 있으면
-- 팝업을 띄워야 하므로(hasUnclassified) 이 조회가 매달 돈다
CREATE INDEX IF NOT EXISTS idx_public_holidays_unclassified
  ON public_holidays(holiday_date) WHERE closure_policy IS NULL;
