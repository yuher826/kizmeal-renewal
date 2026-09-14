-- ★이 파일은 신규 변경이 아니라 "이미 DB에 실행 완료된 것"의 기록이다.
-- 2026-09-14 Supabase 대시보드 SQL Editor에서 아래를 수동 실행 완료했다.
-- Supabase CLI 미사용 — 다른 환경(스테이징 등)에도 반영하려면 이 SQL
-- 전문을 그대로 SQL Editor에 붙여넣어 수동 실행할 것. 지금 다시 실행할
-- 필요 없음 — 재실행해도 무해하도록 멱등 패턴(CREATE OR REPLACE /
-- DROP POLICY IF EXISTS)으로 작성돼 있다.
--
-- 배경: CS(문의) 답변 저장이 화면 가드만 있고 서버(RLS) 검증이 아예
-- 없던 상태였다(director도 완전한 쓰기 가능). 화면 가드(canWriteCs,
-- app/erp/(protected)/inquiries/components/InquiryDetailPanel.tsx)와
-- 이 DB 정책을 반드시 같은 기준으로 유지할 것 — 한쪽만 바뀌면
-- "화면엔 안 보이는데 API로는 되는" 또는 그 반대 상황이 생긴다.
-- 상세 조사·검증 기록은 HANDOFF.md "CS — 답변 권한 화면 가드 구현 +
-- 역할·카테고리 범위 확인 (2026-09-14)" 참고.

-- ============================================================
-- 1) can_write_cs() — CS(문의) 쓰기 가능 여부 판정 함수 (신설)
--    판정 기준: super_admin은 항상 허용, 나머지는 admins.can_handle_cs
--    플래그로만 판단한다. manager를 role로 넣지 않은 이유 — CS 담당은
--    역할이 아니라 사람 단위로 지정되는 배정 구조이기 때문(플래그가
--    곧 배정 기록). 프론트 lib/roles.ts의 canHandleCs와 기준을 반드시
--    일치시킨다 — 한쪽만 바꾸면 화면 가드와 DB 허용 범위가 갈라진다.
-- ============================================================
CREATE OR REPLACE FUNCTION can_write_cs()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE auth_id = auth.uid()
      AND is_active = TRUE
      AND (role = 'super_admin' OR can_handle_cs = TRUE)
  );
END;
$$;

-- ============================================================
-- 2) messages — 쓰기(UPDATE/DELETE) 정책을 is_admin() → can_write_cs()로 교체
--    SELECT/INSERT(고객 발신 포함)는 손대지 않는다 — 읽기와 "문의에
--    답장 가능"은 이번에 좁히는 대상이 아니다.
-- ============================================================
DROP POLICY IF EXISTS "messages_update_admin" ON messages;
CREATE POLICY "messages_update_admin" ON messages
  FOR UPDATE
  USING (can_write_cs());

DROP POLICY IF EXISTS "messages_delete_admin" ON messages;
CREATE POLICY "messages_delete_admin" ON messages
  FOR DELETE
  USING (can_write_cs());

-- ============================================================
-- 3) inquiries — 상태/담당자 변경(UPDATE) 정책을 can_write_cs()로 교체
--    SELECT/INSERT는 기존 그대로(관리자 전체 조회, 지점 본인 문의 생성)
-- ============================================================
DROP POLICY IF EXISTS "inquiries_update_admin" ON inquiries;
CREATE POLICY "inquiries_update_admin" ON inquiries
  FOR UPDATE
  USING (can_write_cs());

-- ============================================================
-- 4) inquiry_notes / phone_logs — 기존 FOR ALL USING(is_admin()) 단일
--    정책(phase2_schema.sql: admin_all_notes/admin_all_phone)을
--    SELECT(열람)와 쓰기(작성)로 분리한다.
--    이유: FOR ALL 그대로 can_write_cs()로만 바꾸면 열람까지 같이
--    막혀 "메모는 못 쓰지만 남이 쓴 메모는 봐야 하는" 읽기전용
--    역할(director 등)이 열람조차 막힌다.
-- ============================================================
DROP POLICY IF EXISTS "admin_all_notes" ON inquiry_notes;
CREATE POLICY "inquiry_notes_select" ON inquiry_notes
  FOR SELECT USING (is_admin());
CREATE POLICY "inquiry_notes_insert" ON inquiry_notes
  FOR INSERT WITH CHECK (can_write_cs());
CREATE POLICY "inquiry_notes_update" ON inquiry_notes
  FOR UPDATE USING (can_write_cs());
CREATE POLICY "inquiry_notes_delete" ON inquiry_notes
  FOR DELETE USING (can_write_cs());

DROP POLICY IF EXISTS "admin_all_phone" ON phone_logs;
CREATE POLICY "phone_logs_select" ON phone_logs
  FOR SELECT USING (is_admin());
CREATE POLICY "phone_logs_insert" ON phone_logs
  FOR INSERT WITH CHECK (can_write_cs());
CREATE POLICY "phone_logs_update" ON phone_logs
  FOR UPDATE USING (can_write_cs());
CREATE POLICY "phone_logs_delete" ON phone_logs
  FOR DELETE USING (can_write_cs());

-- ============================================================
-- 5) parent_inquiries / parent_inquiry_messages — admin 쪽 정책 교체
--    기존 "parent_inq_admin_all"/"parent_inq_msg_admin_all"
--    (inquiry_restructure.sql)은 FOR ALL USING (EXISTS admins WHERE
--    auth_id=auth.uid())로, is_active 조건이 아예 없었다 — 퇴사·비활성
--    admin도 전체 CRUD가 통과되는 완전 permissive 정책이었다
--    (★이번에 같이 고치는 누락 버그). is_admin()/can_write_cs()로
--    교체해 is_active 조건을 되살리고, SELECT와 쓰기를 분리한다.
--    ⚠️ 지점(고객사) 쪽 SELECT/INSERT/UPDATE 정책(parent_inq_select_own,
--    parent_inq_msg_select_own 등, inquiry_restructure.sql)은 별개라
--    이번 변경에서 건드리지 않는다.
-- ============================================================
DROP POLICY IF EXISTS "parent_inq_admin_all" ON parent_inquiries;
CREATE POLICY "parent_inq_admin_select" ON parent_inquiries
  FOR SELECT USING (is_admin());
CREATE POLICY "parent_inq_admin_insert" ON parent_inquiries
  FOR INSERT WITH CHECK (can_write_cs());
CREATE POLICY "parent_inq_admin_update" ON parent_inquiries
  FOR UPDATE USING (can_write_cs());
CREATE POLICY "parent_inq_admin_delete" ON parent_inquiries
  FOR DELETE USING (can_write_cs());

DROP POLICY IF EXISTS "parent_inq_msg_admin_all" ON parent_inquiry_messages;
CREATE POLICY "parent_inq_msg_admin_select" ON parent_inquiry_messages
  FOR SELECT USING (is_admin());
CREATE POLICY "parent_inq_msg_admin_insert" ON parent_inquiry_messages
  FOR INSERT WITH CHECK (can_write_cs());
CREATE POLICY "parent_inq_msg_admin_update" ON parent_inquiry_messages
  FOR UPDATE USING (can_write_cs());
CREATE POLICY "parent_inq_msg_admin_delete" ON parent_inquiry_messages
  FOR DELETE USING (can_write_cs());

-- ============================================================
-- 6) admins.can_handle_cs 플래그 설정 — 권팀장·배서영
-- ============================================================
UPDATE admins SET can_handle_cs = TRUE
WHERE email IN ('desafinado@kizmeal.com', 'sy226@kizmeal.com');
