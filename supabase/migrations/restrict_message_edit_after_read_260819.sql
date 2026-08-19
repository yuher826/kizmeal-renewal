-- 메시지 수정·삭제 DB 단 보강 (권팀장 요청 7번 후속)
--
-- 배경: 진단 결과(pg_policies 실측) messages 테이블에 이미 3개 정책이 있었음
--   - messages_update_admin : 관리자면 무조건 수정 가능(시점 제한 없음)
--   - messages_update_read  : 관리자거나 원 담당자 본인이면 수정 가능(이름과
--                             달리 "읽음"과는 무관한 정책 — 원 담당자 본인
--                             메시지 수정 허용 목적으로 보임)
--   - messages_delete_admin : 관리자면 무조건 삭제 가능(시점 제한 없음)
--   → 지금까지 "읽으면 수정·삭제 불가"는 화면(버튼) 단에서만 막고 있었고,
--     API를 직접 호출하면 이미 읽은 메시지도 수정·삭제가 가능한 상태였음.
--
-- 방식: 기존 3개 정책은 전혀 건드리지 않는다. PostgreSQL의 RESTRICTIVE
-- 정책(허용을 추가하는 게 아니라 "이 경우엔 안 됨"을 얹는 단서 조항)을
-- 새로 추가해서, "관리자가 보낸 일반 메시지(내부메모 제외)인데 원 담당자가
-- 이미 그 대화방을 읽은 뒤"인 경우만 막는다. 원 담당자 본인이 자기
-- 메시지를 고치는 건 sender_type='admin' 조건에 안 걸리니 그대로 허용된다.

DROP POLICY IF EXISTS "messages_block_edit_after_read" ON messages;
CREATE POLICY "messages_block_edit_after_read" ON messages
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    NOT (
      sender_type = 'admin'
      AND COALESCE(is_internal, false) = false
      AND EXISTS (
        SELECT 1 FROM inquiries i
        WHERE i.id = messages.inquiry_id
          AND i.branch_last_read_at IS NOT NULL
          AND messages.created_at <= i.branch_last_read_at
      )
    )
  );

DROP POLICY IF EXISTS "messages_block_delete_after_read" ON messages;
CREATE POLICY "messages_block_delete_after_read" ON messages
  AS RESTRICTIVE
  FOR DELETE
  USING (
    NOT (
      sender_type = 'admin'
      AND COALESCE(is_internal, false) = false
      AND EXISTS (
        SELECT 1 FROM inquiries i
        WHERE i.id = messages.inquiry_id
          AND i.branch_last_read_at IS NOT NULL
          AND messages.created_at <= i.branch_last_read_at
      )
    )
  );
