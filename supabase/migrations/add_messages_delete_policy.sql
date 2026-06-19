-- messages 테이블 삭제 RLS 정책 추가 (관리자만)
DROP POLICY IF EXISTS "messages_delete_admin" ON messages;
CREATE POLICY "messages_delete_admin" ON messages
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true)
  );
