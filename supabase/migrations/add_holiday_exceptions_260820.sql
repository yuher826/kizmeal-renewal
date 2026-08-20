-- 월별 원별 예외설정 — 공휴일 운영여부 + 방학 양식 배정 (2026-08-20)
--
-- 배경: 권팀장 요청의 본질은 "기존 엑셀폼에 입력하면 자동으로 짠 하고 생성".
--   관리자가 원별로 하나하나 찾아 들어가 설정하는 방식은 ERP를 만든 의미가 없다.
--   확인만 하면 되는 팝업 + 저장 1번으로 일괄 반영되어야 한다(유대표 방향 확정).
--
-- ★현재 상태: 원별 공휴일 운영여부의 유일한 진실 저장소가 코드 하드코딩이다.
--     pptx_generator.py:49  _HOLIDAY_OPERATING = {'덕양P', '광교SLP'}
--   날짜 축이 없는 flat set이라 "이 두 원은 모든 공휴일에 운영"으로 동작한다.
--   방학 양식(O/X) 배정은 코드 구현 자체가 아예 없다.
--
-- ★설계 결정 1 — 테이블을 3개로 분리한다(통합 1테이블 검토 후 폐기).
--   공휴일은 자연키가 (날짜, 원), 방학은 (연, 월, 원)으로 축이 다르다.
--   한 테이블에 넣으면 target_date의 null 여부를 CHECK로 가르고 유니크
--   인덱스도 부분 인덱스 2개로 갈라야 한다. 그건 2개 테이블을 1개 안에
--   우겨넣은 것일 뿐 얻는 게 없다. "공휴일·방학 공용 기능"은 팝업/API
--   레벨에서 묶으면 되며 테이블 구조와 무관하다.
--
-- ★설계 결정 2 — 원 참조는 전부 branch_profiles(id)로 통일한다.
--   레포에 선례가 갈려 있다. weekly_menus·diet_review_items는 branches(id),
--   file_archive(260818)와 실제 PPTX 파이프라인(app_actions.py:216)은
--   branch_profiles(id)를 쓴다. 이 기능의 소비자가 PPTX 생성기이므로
--   후자로 확정(유대표 승인 2026-08-20). HANDOFF에 등록된
--   weekly_menus.branch_id 오조회 버그가 이 혼재에서 나온 것으로 보이며,
--   새로 만드는 것부터 통일해 더 번지지 않게 한다.
--
-- ★설계 결정 3 — 공휴일 설정은 "원별 기본값 → 날짜별 실제값" 2단 구조.
--   branch_profiles.operates_on_holidays = 원별 고정 정책(팝업 프리필 소스,
--   현 하드코딩의 이관 대상). branch_holiday_operations = 그 달 그 날짜의
--   실제 결정값. 저장이 날짜 단위라 나중에 "덕양P는 어린이날만 운영" 같은
--   요구가 와도 마이그레이션 없이 받는다. 반면 UX는 기본값이 이미 채워져
--   있으므로 "확인만 하면 되는" 목표가 유지된다.
--
-- ★공휴일 날짜 출처: data.go.kr 한국천문연구원 특일 정보 API
--   (getRestDeInfo, 무료·자동승인, 개발계정 일 10,000건, _type=json 지원).
--   단 임시공휴일·재보궐선거는 사후 지정되고 API 데이터도 "앞으로 약 1년치"만
--   수기 입력되므로, 연초 1회 수집만으로는 원리적으로 못 잡는다.
--
-- ★설계 결정 4 — 갱신 주기는 "월별 diff 감지"로 확정(유대표 승인 2026-08-20).
--   매달 폼 생성 시점에 해당 월을 API로 재조회 → 저장값과 diff →
--   변경이 있을 때만 팝업을 띄운다. 어차피 매달 폼을 만드니 훅이 이미 있고,
--   평소엔 diff가 없어 팝업이 안 뜨므로 "확인만 하면 되는" UX가 유지된다.
--   연초 1회 수집·승인 방식은 위 사후지정 문제로 폐기.
--   → confirmed_at은 행 단위로 남긴다(그 달 새로 뜬 공휴일만 미확인 상태).
--     source='manual'은 API가 아직 안 올린 임시공휴일의 수동 입력 탈출구.
--
-- ⚠️ 이 마이그레이션은 스키마만 만든다. pptx_generator.py의
--    _HOLIDAY_OPERATING 하드코딩 제거는 별도 커밋으로 분리한다
--    (49개 원 전부에 영향 가는 파일이라 스키마 안정 확인 후 착수).

-- ── 1. 공휴일 마스터 ────────────────────────────────────────
-- 원과 무관한 "그날이 공휴일인가" 사실만. API 수집 결과의 캐시 겸 승인대장.
CREATE TABLE IF NOT EXISTS public_holidays (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  holiday_date  date NOT NULL,
  -- API dateName 원문. 식단표 공휴일 칸의 사유 표기에 그대로 쓴다
  -- (예: '제9회 전국동시지방선거', '설날'). read_excel.parse_header()가
  -- 헤더 괄호에서 뽑아내던 값과 같은 성격
  name          text NOT NULL,

  -- kasi_api = 특일정보 API 수집분
  -- manual    = API가 아직 안 올린 임시공휴일 등을 사람이 직접 넣은 것
  source        text NOT NULL DEFAULT 'kasi_api'
                  CHECK (source IN ('kasi_api', 'manual')),

  synced_at     timestamptz NOT NULL DEFAULT now(),

  -- 관리자 승인 흔적. NULL이면 "아직 확인 안 한 신규 공휴일" → 팝업 대상
  confirmed_by  uuid REFERENCES admins(id) ON DELETE SET NULL,
  confirmed_at  timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- 같은 날짜가 두 번 들어오지 않게. 아래 FK의 참조 대상이기도 하다
  CONSTRAINT public_holidays_date_key UNIQUE (holiday_date)
);

COMMENT ON TABLE  public_holidays IS
  '공휴일 마스터. data.go.kr 특일정보 API(getRestDeInfo) 수집분 + 수동 추가분.';
COMMENT ON COLUMN public_holidays.name IS
  'API dateName 원문. 식단표 공휴일 칸 사유 표기에 사용';
COMMENT ON COLUMN public_holidays.source IS
  'kasi_api=API 수집 / manual=임시공휴일 등 수동 입력(API 사후 반영 대비)';
COMMENT ON COLUMN public_holidays.confirmed_at IS
  'NULL=관리자 미확인(팝업 대상). 매달 폼 생성 시 API 재조회→diff→변경분만 팝업';

-- 연·월 단위 조회(그 달 공휴일 목록)는 날짜 범위 스캔
--   WHERE holiday_date BETWEEN '2026-06-01' AND '2026-06-30'
-- 이며, 위 UNIQUE (holiday_date)가 만드는 btree 인덱스를 그대로 탄다.
-- EXTRACT() 표현식 인덱스는 중복인 데다 IMMUTABLE 요건에 걸릴 소지가 있어 두지 않는다.

-- 미확인 공휴일만 빠르게 (팝업 띄울지 판단)
CREATE INDEX IF NOT EXISTS idx_public_holidays_unconfirmed
  ON public_holidays(holiday_date) WHERE confirmed_at IS NULL;


-- ── 2. 원별·날짜별 공휴일 운영 여부 ─────────────────────────
CREATE TABLE IF NOT EXISTS branch_holiday_operations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 자연키 FK. uuid 대신 날짜로 참조하는 이유 — PPTX 생성 시
  -- (원, 날짜)로 바로 조회해야 하는데 uuid FK면 매번 조인이 붙는다.
  -- public_holidays에서 날짜가 지워지면 그 결정값도 같이 정리되어야 하므로 CASCADE
  holiday_date      date NOT NULL
                      REFERENCES public_holidays(holiday_date) ON DELETE CASCADE,

  -- ★branches(id)가 아니라 branch_profiles(id) — 위 설계 결정 2 참고
  branch_profile_id uuid NOT NULL
                      REFERENCES branch_profiles(id) ON DELETE CASCADE,

  -- true  = 그날 운영(메뉴를 채운다)
  -- false = 휴원(중식 칸에 날짜+사유만 남고 나머지 섹션은 비움)
  is_operating      boolean NOT NULL,

  -- default      = branch_profiles.operates_on_holidays 기본값 그대로
  -- carried_over = 전년도 동시기 값을 물려받음
  -- manual       = 사람이 팝업에서 직접 바꿈
  source            text NOT NULL DEFAULT 'default'
                      CHECK (source IN ('default', 'carried_over', 'manual')),

  decided_by        uuid REFERENCES admins(id) ON DELETE SET NULL,
  decided_at        timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bho_uniq UNIQUE (holiday_date, branch_profile_id)
);

COMMENT ON TABLE  branch_holiday_operations IS
  '원별·날짜별 공휴일 운영여부. pptx_generator.py의 _HOLIDAY_OPERATING 하드코딩을 대체할 저장소.';
COMMENT ON COLUMN branch_holiday_operations.is_operating IS
  'true=그날 운영(메뉴 채움) / false=휴원(날짜+사유만 표시)';
COMMENT ON COLUMN branch_holiday_operations.source IS
  'default=원 기본정책 그대로 / carried_over=전년도 동시기 승계 / manual=팝업에서 직접 변경';

-- (holiday_date, branch_profile_id) 유니크가 holiday_date 선두 인덱스를 겸하므로
-- 그 달 전체 조회는 커버됨. 원 기준 역방향 조회만 별도로
CREATE INDEX IF NOT EXISTS idx_bho_branch
  ON branch_holiday_operations(branch_profile_id);


-- ── 3. 원별·월별 방학 양식 배정 ─────────────────────────────
-- 디자이너는 방학O·방학X 공용 양식 2벌만 준다. 어느 원이 O/X인지는
-- 디자이너가 모르는 우리 쪽 정보라 배정표를 우리가 갖고 있어야 한다.
-- 방학 그림 자체를 코드가 삽입·크기조정할 필요는 없다(HANDOFF 발견③) —
-- 원별로 어느 양식을 쓸지 고르기만 하면 된다.
CREATE TABLE IF NOT EXISTS branch_monthly_vacation (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  year              int NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  month             int NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- ★설계 결정 2 — branch_profiles(id) 기준
  branch_profile_id uuid NOT NULL
                      REFERENCES branch_profiles(id) ON DELETE CASCADE,

  -- true = 방학O 양식, false = 방학X 양식
  has_vacation      boolean NOT NULL,

  source            text NOT NULL DEFAULT 'carried_over'
                      CHECK (source IN ('default', 'carried_over', 'manual')),

  decided_by        uuid REFERENCES admins(id) ON DELETE SET NULL,
  decided_at        timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bmv_uniq UNIQUE (year, month, branch_profile_id)
);

COMMENT ON TABLE  branch_monthly_vacation IS
  '원별·월별 방학 양식(O/X) 배정. 방학 없는 달은 행 자체를 만들지 않는다.';
COMMENT ON COLUMN branch_monthly_vacation.has_vacation IS
  'true=방학O 양식 사용 / false=방학X 양식 사용. 한 원의 방학 유무는 학기 단위로 거의 고정';

-- (year, month, branch_profile_id) 유니크가 (year, month) 선두를 커버.
-- 원 기준 역방향(그 원의 작년 같은 달 = 전년도 승계 조회)만 별도로
CREATE INDEX IF NOT EXISTS idx_bmv_branch
  ON branch_monthly_vacation(branch_profile_id, year, month);


-- ── 4. 기존 테이블 확장 ─────────────────────────────────────

-- 4-1) 원별 공휴일 운영 기본 정책
--      = pptx_generator.py:49 _HOLIDAY_OPERATING 하드코딩의 이관 대상.
--      팝업이 branch_holiday_operations 행을 만들 때 프리필 기본값으로 쓴다.
ALTER TABLE branch_profiles
  ADD COLUMN IF NOT EXISTS operates_on_holidays boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN branch_profiles.operates_on_holidays IS
  '공휴일 기본 운영 정책. 팝업 프리필 기본값. 날짜별 실제값은 branch_holiday_operations';

-- 현 하드코딩 값 이관 (덕양P, 광교SLP). 지금 동작을 그대로 보존하는 것이
-- 목적이며, 이후 관리는 ERP UI에서 한다. 재실행해도 안전
UPDATE branch_profiles
   SET operates_on_holidays = true
 WHERE short_code IN ('덕양P', '광교SLP')
   AND operates_on_holidays IS DISTINCT FROM true;

-- 4-2) 템플릿의 방학 축
--      template_resolver.py:52-56이 "연·월당 active 템플릿 1개"를 전제하는데
--      방학 O/X 2벌과 정면 충돌한다. 이 컬럼으로 축을 하나 늘려서
--      resolver가 원별로 분기할 수 있게 한다.
--      app.py·app_actions.py 양쪽이 template_resolver만 거치므로 수정은 한 곳.
ALTER TABLE diet_templates
  ADD COLUMN IF NOT EXISTS vacation_variant text NOT NULL DEFAULT 'none'
    CHECK (vacation_variant IN ('none', 'vacation_on', 'vacation_off'));

COMMENT ON COLUMN diet_templates.vacation_variant IS
  'none=방학 무관 단일양식(평월) / vacation_on=방학O / vacation_off=방학X';


-- ── 5. updated_at 자동 갱신 ─────────────────────────────────
-- 세 테이블이 함께 쓰는 공용 트리거 함수
-- (file_archive_touch_updated_at 패턴. 마이그레이션 실행 순서에 의존하지
--  않도록 이 파일 안에서 자급자족한다)
CREATE OR REPLACE FUNCTION holiday_exceptions_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_holidays_updated_at ON public_holidays;
CREATE TRIGGER trg_public_holidays_updated_at
  BEFORE UPDATE ON public_holidays
  FOR EACH ROW EXECUTE FUNCTION holiday_exceptions_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bho_updated_at ON branch_holiday_operations;
CREATE TRIGGER trg_bho_updated_at
  BEFORE UPDATE ON branch_holiday_operations
  FOR EACH ROW EXECUTE FUNCTION holiday_exceptions_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bmv_updated_at ON branch_monthly_vacation;
CREATE TRIGGER trg_bmv_updated_at
  BEFORE UPDATE ON branch_monthly_vacation
  FOR EACH ROW EXECUTE FUNCTION holiday_exceptions_touch_updated_at();


-- ── 6. RLS ──────────────────────────────────────────────────
-- 셋 다 관리자 전용 설정 데이터다. 고객사(원)가 읽을 이유가 없으므로
-- branch_read 정책을 두지 않는다.
-- 참고: PPTX 파이프라인(app_actions.py, gen_form.py)은 SUPABASE_SERVICE_KEY로
--       REST를 직접 호출하므로 RLS를 우회한다 — 생성 경로는 영향 없음.
ALTER TABLE public_holidays           ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_holiday_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_monthly_vacation   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_holidays_admin_all" ON public_holidays;
CREATE POLICY "public_holidays_admin_all" ON public_holidays FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "bho_admin_all" ON branch_holiday_operations;
CREATE POLICY "bho_admin_all" ON branch_holiday_operations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "bmv_admin_all" ON branch_monthly_vacation;
CREATE POLICY "bmv_admin_all" ON branch_monthly_vacation FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true)
  );
