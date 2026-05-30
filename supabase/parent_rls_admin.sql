-- 어드민이 admins 테이블에 존재하는지 확인하는 헬퍼
-- parents, children 테이블에 어드민 접근 정책 추가

-- ── parents 테이블 ──────────────────────────────────────────────

-- 어드민: 전체 조회
CREATE POLICY "parents_select_admin" ON parents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );

-- 어드민: 상태 변경 (승인/거절)
CREATE POLICY "parents_update_admin" ON parents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );

-- ── children 테이블 ─────────────────────────────────────────────

-- 어드민: 전체 조회
CREATE POLICY "children_select_admin" ON children
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );
