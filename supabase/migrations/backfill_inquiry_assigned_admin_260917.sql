-- 2026-09-17 Supabase 대시보드 SQL Editor 수동 실행 완료.
-- 담당자가 비어 있던 처리중·완료 문의에 첫 고객 대상 관리자 답변자(활성 계정)를 채움.
-- 실행 결과: 4건 채움(권팀장 3, 유성모 1). "테스트 알림" 1건은 관리자 답변이 없어 비워둠.
-- 조건부(assigned_admin_id IS NULL)라 다시 실행해도 안전하다.
UPDATE inquiries i
SET assigned_admin_id = fr.admin_id
FROM (
  SELECT DISTINCT ON (m.inquiry_id) m.inquiry_id, a.id AS admin_id
  FROM messages m
  JOIN admins a ON a.auth_id = m.sender_id
  WHERE m.sender_type = 'admin'
    AND COALESCE(m.is_internal, false) = false
    AND a.is_active = true
  ORDER BY m.inquiry_id, m.created_at
) fr
WHERE i.id = fr.inquiry_id
  AND i.assigned_admin_id IS NULL
  AND i.status <> 'pending'
RETURNING i.id, i.status, i.title, i.assigned_admin_id;
