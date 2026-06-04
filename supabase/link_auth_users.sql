-- ============================================================
-- 기존 Supabase Auth 유저 → 앱 테이블 연결
-- (Auth 대시보드에서 이미 유저를 생성한 경우 실행)
-- ============================================================

-- admins 테이블에 department 컬럼 추가 (없으면)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS
  department TEXT;


-- ============================================================
-- [1] 관리자 연결: admin@kizmeal.com → admins 테이블
-- ============================================================
INSERT INTO admins (auth_id, name, email, role, department, is_active)
SELECT
  id,                  -- auth.users.id
  '키즈밀관리자',
  'admin@kizmeal.com',
  'super_admin',       -- CHECK 제약: 'super_admin' | 'admin'
  'general',
  TRUE
FROM auth.users
WHERE email = 'admin@kizmeal.com'
ON CONFLICT (email) DO UPDATE
  SET auth_id    = EXCLUDED.auth_id,
      role       = EXCLUDED.role,
      department = EXCLUDED.department,
      updated_at = NOW();


-- ============================================================
-- [2] 가맹점 연결: test@poly.com → brands + branches 테이블
-- ============================================================

-- 브랜드 등록
INSERT INTO brands (name, code, is_active)
VALUES ('Poly', 'POLY', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 지점 등록
INSERT INTO branches (brand_id, auth_id, kos_id, name, owner_name, email, is_active)
SELECT
  b.id,                -- brands.id (POLY)
  u.id,                -- auth.users.id
  'POLY-KANGNAM',
  '강남점',
  '테스트 원장',        -- owner_name NOT NULL 필수값
  'test@poly.com',
  TRUE
FROM auth.users   u
JOIN brands       b ON b.code = 'POLY'
WHERE u.email = 'test@poly.com'
ON CONFLICT (kos_id) DO UPDATE
  SET auth_id    = EXCLUDED.auth_id,
      updated_at = NOW();


-- ============================================================
-- 결과 확인
-- ============================================================
SELECT
  u.email,
  CASE
    WHEN a.id IS NOT NULL THEN '관리자 (' || a.role || ')'
    WHEN br.id IS NOT NULL THEN '가맹점 (' || bd.name || ' · ' || br.name || ')'
    ELSE '연결 안 됨'
  END AS "연결 상태",
  u.created_at::date AS "Auth 생성일"
FROM auth.users u
LEFT JOIN admins   a  ON a.auth_id = u.id
LEFT JOIN branches br ON br.auth_id = u.id
LEFT JOIN brands   bd ON bd.id      = br.brand_id
WHERE u.email IN ('admin@kizmeal.com', 'test@poly.com')
ORDER BY u.created_at;
