-- 2026-09-17 Supabase 대시보드 SQL Editor 수동 실행 완료.
-- 이어받기 알림(takeover) 추가. 기존 행은 영향 없음.
ALTER TABLE cs_notifications DROP CONSTRAINT IF EXISTS cs_notifications_kind_check;
ALTER TABLE cs_notifications ADD CONSTRAINT cs_notifications_kind_check
  CHECK (kind = ANY (ARRAY['new_inquiry'::text, 'new_message'::text, 'takeover'::text]));
