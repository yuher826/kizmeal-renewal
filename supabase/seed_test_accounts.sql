-- ============================================================
-- 키즈밀 테스트 계정 생성 SQL
-- Supabase SQL Editor에서 실행하세요
-- ============================================================
-- ※ 주의: 이미 계정이 존재하면 건너뜁니다 (안전하게 재실행 가능)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- [1] 관리자 계정 — admin@kizmeal.com / Kizmeal2024!
-- ============================================================
DO $$
DECLARE
  v_uid UUID;
BEGIN
  -- 이미 존재하면 스킵
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@kizmeal.com') THEN
    RAISE NOTICE '관리자 계정이 이미 존재합니다: admin@kizmeal.com';
    RETURN;
  END IF;

  v_uid := gen_random_uuid();

  -- auth.users 생성
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new,
    email_change_confirm_status
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@kizmeal.com',
    crypt('Kizmeal2024!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"키즈밀 관리자"}',
    FALSE,
    NOW(), NOW(),
    '', '', '', '', 0
  );

  -- auth.identities 생성
  INSERT INTO auth.identities (
    provider_id, user_id,
    identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    'admin@kizmeal.com',
    v_uid,
    jsonb_build_object(
      'sub',            v_uid::text,
      'email',          'admin@kizmeal.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(), NOW(), NOW()
  );

  -- admins 테이블 등록
  INSERT INTO admins (auth_id, name, email, role, is_active)
  VALUES (v_uid, '키즈밀 관리자', 'admin@kizmeal.com', 'super_admin', TRUE);

  RAISE NOTICE '✅ 관리자 계정 생성 완료: admin@kizmeal.com (auth_id: %)', v_uid;
END $$;


-- ============================================================
-- [2] 테스트 가맹점 계정 — test@poly.com / Test1234!
-- ============================================================
DO $$
DECLARE
  v_uid      UUID;
  v_brand_id UUID;
  v_branch_id UUID;
BEGIN
  -- 이미 존재하면 스킵
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'test@poly.com') THEN
    RAISE NOTICE '가맹점 계정이 이미 존재합니다: test@poly.com';
    RETURN;
  END IF;

  v_uid       := gen_random_uuid();
  v_branch_id := gen_random_uuid();

  -- 브랜드 등록 (없으면 생성)
  INSERT INTO brands (name, code, is_active)
  VALUES ('Poly', 'POLY', TRUE)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_brand_id FROM brands WHERE code = 'POLY';

  -- auth.users 생성
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new,
    email_change_confirm_status
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'test@poly.com',
    crypt('Test1234!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"강남점"}',
    FALSE,
    NOW(), NOW(),
    '', '', '', '', 0
  );

  -- auth.identities 생성
  INSERT INTO auth.identities (
    provider_id, user_id,
    identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    'test@poly.com',
    v_uid,
    jsonb_build_object(
      'sub',            v_uid::text,
      'email',          'test@poly.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(), NOW(), NOW()
  );

  -- branches 테이블 등록
  INSERT INTO branches (
    id, brand_id, auth_id,
    kos_id, name, owner_name, email,
    is_active
  ) VALUES (
    v_branch_id,
    v_brand_id,
    v_uid,
    'POLY-GN-001',
    '강남점',
    '테스트 원장',
    'test@poly.com',
    TRUE
  );

  RAISE NOTICE '✅ 가맹점 계정 생성 완료: test@poly.com (auth_id: %, branch_id: %)', v_uid, v_branch_id;
END $$;


-- ============================================================
-- [3] 테스트 가맹점 계정2 — branch1@kizmeal.com / Kizmeal2024!
--     → branches 테이블 첫 번째 지점에 연결
--     → 첫 번째 지점이 없으면 새로 생성
-- ============================================================
DO $$
DECLARE
  v_uid       UUID;
  v_brand_id  UUID;
  v_branch_id UUID;
BEGIN
  -- auth.users에 이미 있으면 스킵 없이 branches만 연결
  SELECT id INTO v_uid FROM auth.users WHERE email = 'branch1@kizmeal.com';

  -- 계정이 없으면 신규 생성
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new,
      email_change_confirm_status
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'branch1@kizmeal.com',
      crypt('Kizmeal2024!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"키즈밀 1지점"}',
      FALSE,
      NOW(), NOW(),
      '', '', '', '', 0
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      'branch1@kizmeal.com',
      v_uid,
      jsonb_build_object(
        'sub',            v_uid::text,
        'email',          'branch1@kizmeal.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(), NOW(), NOW()
    );

    RAISE NOTICE '✅ branch1@kizmeal.com auth.users 생성 완료 (uid: %)', v_uid;
  ELSE
    RAISE NOTICE '⚠️  branch1@kizmeal.com 이미 존재 — branches 연결만 진행 (uid: %)', v_uid;
  END IF;

  -- 기존 branches 연결 초기화 (이 계정이 다른 지점에 물려 있는 경우 해제)
  UPDATE branches SET auth_id = NULL WHERE auth_id = v_uid;

  -- 첫 번째 지점 조회
  SELECT id, brand_id INTO v_branch_id, v_brand_id
  FROM branches
  ORDER BY created_at ASC
  LIMIT 1;

  -- 지점이 하나도 없으면 기본 지점 생성
  IF v_branch_id IS NULL THEN
    INSERT INTO brands (name, code, is_active)
    VALUES ('키즈밀', 'KIZMEAL', TRUE)
    ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_brand_id FROM brands WHERE code = 'KIZMEAL';

    v_branch_id := gen_random_uuid();

    INSERT INTO branches (id, brand_id, auth_id, kos_id, name, owner_name, email, is_active)
    VALUES (
      v_branch_id, v_brand_id, v_uid,
      'KZ-001', '키즈밀 1지점', '테스트 원장',
      'branch1@kizmeal.com', TRUE
    );

    RAISE NOTICE '✅ 새 지점 생성 완료 (branch_id: %)', v_branch_id;
  ELSE
    -- 첫 번째 지점에 auth_id 연결
    UPDATE branches
    SET auth_id = v_uid, updated_at = NOW()
    WHERE id = v_branch_id;

    RAISE NOTICE '✅ 기존 지점에 연결 완료 (branch_id: %)', v_branch_id;
  END IF;

END $$;


-- ============================================================
-- [4] 비밀번호 통일 — 이미 존재하던 계정도 Kizmeal2024! 로 강제 갱신
--     (위 블록은 "이미 존재하면 스킵"이라 재실행 시 비밀번호가 안 바뀜)
-- ============================================================
UPDATE auth.users
SET encrypted_password = crypt('Kizmeal2024!', gen_salt('bf')),
    updated_at = NOW()
WHERE email IN ('admin@kizmeal.com', 'branch1@kizmeal.com');

-- ============================================================
-- 생성 결과 확인
-- ============================================================
SELECT
  u.email,
  CASE
    WHEN a.id IS NOT NULL THEN '관리자 (' || a.role || ')'
    WHEN b.id IS NOT NULL THEN '가맹점 (' || br.name || ' · ' || b.name || ')'
    ELSE '미분류 ❌'
  END AS "계정 유형",
  b.id   AS "branch_id",
  u.email_confirmed_at IS NOT NULL AS "이메일 인증",
  u.created_at::date AS "생성일"
FROM auth.users u
LEFT JOIN admins   a  ON a.auth_id  = u.id
LEFT JOIN branches b  ON b.auth_id  = u.id
LEFT JOIN brands   br ON br.id      = b.brand_id
WHERE u.email IN ('admin@kizmeal.com', 'test@poly.com', 'branch1@kizmeal.com')
ORDER BY u.created_at;
