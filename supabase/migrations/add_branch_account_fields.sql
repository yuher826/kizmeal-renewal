-- branches 테이블에 포털 계정 관련 컬럼 추가
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS kos_id text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- auth_user_id (auth_id 컬럼이 이미 없는 경우에만)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS auth_id uuid;

COMMENT ON COLUMN branches.kos_id IS
  'KOS 마스터 아이디 — 향후 KOS API 연동 시 매핑 키';
COMMENT ON COLUMN branches.last_login_at IS
  '포털 마지막 로그인 일시';
COMMENT ON COLUMN branches.auth_id IS
  'Supabase Auth user.id — 포털 계정 연결';
