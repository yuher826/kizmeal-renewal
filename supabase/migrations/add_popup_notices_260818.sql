-- 팝업 공지 기능 신설 (권팀장 요청 4번)
--
-- 배경: 착수 전 진단(pg_policies 실측)으로 parent_notices에 정책이 딱 2개뿐임을 확인.
--   1) admin_notices_all   : admins 테이블에 auth_id 매칭되면 전체 CRUD 허용
--   2) parent_notices_select: branch_id IS NULL(전체 공지) 이거나
--                              학부모(children.parent_id = auth.uid() 조인)만 SELECT 허용
--   → 고객사(원 담당자, branches/branch_members 계정)가 "특정 원" 공지를 읽을 수 있는
--     정책이 존재하지 않았음. 지금까지 "특정 원" 공지를 아무도 실제로 만들어본 적이
--     없어서 드러나지 않았던 버그.
--   기존 2개 정책은 건드리지 않고, 원 담당자용 정책만 추가한다(대체가 아니라 추가).

-- 1) 팝업 필드 추가
ALTER TABLE parent_notices
  ADD COLUMN IF NOT EXISTS is_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_until timestamptz;

COMMENT ON COLUMN parent_notices.is_popup IS '고객 포털 로그인 시 모달로 노출할지 여부';
COMMENT ON COLUMN parent_notices.popup_until IS '팝업 노출 종료 시각(NULL이면 is_popup을 끄기 전까지 계속 노출)';

-- 2) 원 담당자(고객사) 전용 SELECT 정책 신설
DROP POLICY IF EXISTS "parent_notices_select_branch" ON parent_notices;
CREATE POLICY "parent_notices_select_branch" ON parent_notices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.auth_id = auth.uid() AND b.id = parent_notices.branch_id
    )
    OR EXISTS (
      SELECT 1 FROM branch_members bm
      WHERE bm.auth_id = auth.uid() AND bm.branch_id = parent_notices.branch_id
    )
  );
