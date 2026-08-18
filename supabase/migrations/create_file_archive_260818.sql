-- 파일보관함(file_archive) 신설 (2026-08-18 권팀장 요청 2번)
--
-- 배경: 고객사 포털 좌측 메뉴의 "식단표"를 "파일보관함"으로 확장.
--   식단표 외에 건강정보지·기타 유인물·식단사진 등 고객사에 전달되는
--   모든 파일을 한 곳에서 열람할 수 있게 한다.
--   식대청구서는 KOS에서 전달되므로 이 기능에서 제외(권팀장 확인).
--
-- ★설계 결정: 식단표는 이 테이블로 옮기지 않는다(A안).
--   식단표는 기존 weekly_menus에 그대로 두고, 화면에서 두 소스를 합쳐
--   보여준다. 식단표 자동생성 파이프라인(app_actions.py)이 2026-08-18에
--   막 안정화된 상태라, 얻는 이득(화면 코드 단순화) 대비 건드리는
--   위험이 크다고 판단.
--
-- ★배포 범위 3단계:
--   - 전체 공통(scope='all')    : 모든 원에 노출
--   - 그룹 공통(scope='group')  : diet_type이 같은 원에만 노출
--                                 (CK 영양사팀 건강정보지 ↔ 위탁 영양사 건강정보지)
--   - 원별 개별(scope='branch') : 지정한 원 하나에만 노출
--   임시원(크레오)은 그룹에 안 묶여 있어 기본적으로 그룹 공통 파일이
--   안 보인다. 나중에 "우리도 받고 싶다"고 하면 scope='branch'로
--   그 원에만 올려주면 되므로 코드 수정 없이 운영으로 대응 가능.

-- ── 1. 테이블 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_archive (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 파일 종류(좌측 탭). 식단표(diet)는 weekly_menus에서 오므로 여기 없음
  category      text NOT NULL
                  CHECK (category IN ('health_info', 'handout', 'photo', 'etc')),

  title         text NOT NULL,          -- 목록에 보이는 파일명
  file_url      text NOT NULL,          -- Storage public URL
  file_size     bigint,                 -- 바이트. 목록에 크기 표시용(선택)

  -- 자료 기준 연/월. 업로드일과 다를 수 있음
  -- (9월 자료를 8월에 미리 올리는 경우) → 연·월 필터가 이 값을 쓴다
  year          int NOT NULL,
  month         int NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- 배포 범위
  scope         text NOT NULL DEFAULT 'all'
                  CHECK (scope IN ('all', 'group', 'branch')),
  -- scope='group'일 때만 사용. 'ck' 또는 'consignment'
  scope_diet_type text,
  -- scope='branch'일 때만 사용. branch_profiles.id 참조
  -- (weekly_menus.branch_id와 동일한 기준 — HANDOFF 참고)
  scope_branch_id uuid REFERENCES branch_profiles(id) ON DELETE CASCADE,

  uploaded_by   uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- scope와 해당 참조 컬럼의 정합성 보장
  CONSTRAINT file_archive_scope_ref_chk CHECK (
    (scope = 'all'    AND scope_diet_type IS NULL AND scope_branch_id IS NULL) OR
    (scope = 'group'  AND scope_diet_type IS NOT NULL AND scope_branch_id IS NULL) OR
    (scope = 'branch' AND scope_diet_type IS NULL AND scope_branch_id IS NOT NULL)
  )
);

COMMENT ON TABLE  file_archive IS
  '고객사 포털 파일보관함. 식단표는 weekly_menus에 있고 여기 포함되지 않음(A안).';
COMMENT ON COLUMN file_archive.year IS
  '자료 기준 연도(업로드일 아님). 예: 8월에 올린 9월 건강정보지 → 2026';
COMMENT ON COLUMN file_archive.scope IS
  'all=전원 / group=같은 diet_type 원만 / branch=지정 원 하나만';

-- ── 2. 인덱스 ───────────────────────────────────────────────
-- 목록 기본 정렬(최신순) + 연·월 필터
CREATE INDEX IF NOT EXISTS idx_file_archive_ym
  ON file_archive(year DESC, month DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_archive_category
  ON file_archive(category);
CREATE INDEX IF NOT EXISTS idx_file_archive_scope_branch
  ON file_archive(scope_branch_id) WHERE scope_branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_archive_scope_group
  ON file_archive(scope_diet_type) WHERE scope_diet_type IS NOT NULL;

-- ── 3. updated_at 자동 갱신 ─────────────────────────────────
CREATE OR REPLACE FUNCTION file_archive_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_file_archive_updated_at ON file_archive;
CREATE TRIGGER trg_file_archive_updated_at
  BEFORE UPDATE ON file_archive
  FOR EACH ROW EXECUTE FUNCTION file_archive_touch_updated_at();

-- ── 4. RLS ──────────────────────────────────────────────────
ALTER TABLE file_archive ENABLE ROW LEVEL SECURITY;

-- 4-1) 현재 로그인 계정의 branch_profiles.id를 돌려주는 헬퍼
--      master 계정(branches.auth_id)과 member 계정(branch_members.auth_id)
--      양쪽을 모두 지원. SECURITY DEFINER로 RLS 재귀 회피
--      (weekly_menus_rls_v2.sql의 wm_get_my_role() 패턴 참고)
CREATE OR REPLACE FUNCTION fa_my_branch_profile_id()
RETURNS uuid
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT bp.id
  FROM   branch_profiles bp
  WHERE  bp.branch_id IN (
           SELECT b.id FROM branches b WHERE b.auth_id = auth.uid()
           UNION
           SELECT bm.branch_id FROM branch_members bm WHERE bm.auth_id = auth.uid()
         )
  LIMIT 1;
$$;

-- 4-2) 현재 로그인 계정 원의 diet_type
CREATE OR REPLACE FUNCTION fa_my_diet_type()
RETURNS text
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT lower(bp.diet_type)
  FROM   branch_profiles bp
  WHERE  bp.id = fa_my_branch_profile_id()
  LIMIT 1;
$$;

-- 4-3) 관리자: 전체 권한
DROP POLICY IF EXISTS "file_archive_admin_all" ON file_archive;
CREATE POLICY "file_archive_admin_all" ON file_archive FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true)
  );

-- 4-4) 고객사: 자기에게 배포된 파일만 읽기
--      lower()로 비교하는 이유 — diet_type 값이 테이블마다 'ck'/'CK'로
--      섞여 있어 대소문자 차이로 누락되는 것을 방지
DROP POLICY IF EXISTS "file_archive_branch_read" ON file_archive;
CREATE POLICY "file_archive_branch_read" ON file_archive FOR SELECT
  USING (
    scope = 'all'
    OR (scope = 'group'  AND lower(scope_diet_type) = fa_my_diet_type())
    OR (scope = 'branch' AND scope_branch_id = fa_my_branch_profile_id())
  );
