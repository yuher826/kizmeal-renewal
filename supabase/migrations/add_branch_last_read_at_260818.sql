-- 발송 후 상대방 수신 전이면 메시지 수정/삭제 가능 (권팀장 요청 7번)
--
-- 배경: /erp/inquiries(InquiryDetailPanel.tsx)에 메시지 수정·삭제 기능은
-- 이미 있었지만 시점 제한이 전혀 없어서, 원 담당자가 이미 읽고 답장까지
-- 한 메시지도 나중에 수정·삭제할 수 있었음. "읽음" 기준은 기존
-- unread_count_branch 리셋과 동일하게 "원 담당자가 그 대화방 페이지를
-- 열었는지"로 통일한다(별도 정교한 열람 추적 인프라는 만들지 않음).

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS branch_last_read_at timestamptz;

COMMENT ON COLUMN inquiries.branch_last_read_at IS
  '원 담당자가 마지막으로 이 대화방을 연 시각. 이 시각 이후 관리자 메시지만 수정·삭제 가능(권팀장 요청 7번)';
