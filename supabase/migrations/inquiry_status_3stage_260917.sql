-- 2026-09-17 Supabase 대시보드 SQL Editor 수동 실행 완료.
-- CS 상태 4단계 → 3단계. DB 값은 유지하고 화면 라벨만 바꾼다.
-- 실행 전 실측: closed 1, in_progress 4, pending 3, resolved 0
-- 실행 후 확인: in_progress 4, pending 3, resolved 1 (총 8건, 손실 없음)
-- ★순서 중요 — 데이터를 먼저 옮기고 제약을 좁힌다. 반대로 하면 거부된다.
UPDATE inquiries SET status='resolved', resolved_at=COALESCE(resolved_at, closed_at)
WHERE status='closed';
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check
  CHECK (status = ANY (ARRAY['pending'::text,'in_progress'::text,'resolved'::text]));
