-- ================================================================
-- weekly_menus 학부모 SELECT 정책
--
-- 조건:
--   parents.auth_id = auth.uid()  — 현재 로그인한 학부모
--   parents.status  = 'approved'  — 승인된 학부모만
--   children.parent_id = parents.id
--   children.is_active = true     — 활성 원아만
--   children.branch_id = weekly_menus.branch_id — 자녀의 원 식단만
--
-- 실행 전제: weekly_menus에 ROW LEVEL SECURITY가 이미 활성화되어 있어야 함
--           (create_branch_profiles_and_weekly_menus.sql에서 이미 활성화됨)
-- ================================================================

CREATE POLICY "wm_select_parent"
ON weekly_menus
FOR SELECT
USING (
  branch_id IS NOT NULL
  AND branch_id IN (
    SELECT c.branch_id
    FROM   children c
    JOIN   parents  p ON p.id = c.parent_id
    WHERE  p.auth_id   = auth.uid()
      AND  p.status    = 'approved'
      AND  c.is_active = true
  )
);

-- 결과 확인
SELECT policyname, cmd, qual AS using_expr
FROM pg_policies
WHERE tablename = 'weekly_menus'
ORDER BY cmd, policyname;
