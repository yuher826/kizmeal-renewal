-- ① ck_locations 테이블 (CK 호점 관리)
CREATE TABLE IF NOT EXISTS ck_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ck_locations (name, address)
VALUES ('1호점', '경기도 안양시 동안구 흥안대로439번길 30 8층')
ON CONFLICT (name) DO NOTHING;

-- ② admins 컬럼 추가
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS diet_scope
    TEXT CHECK (diet_scope IN ('ck','consignment')),
  ADD COLUMN IF NOT EXISTS ck_location_id
    UUID REFERENCES ck_locations(id),
  ADD COLUMN IF NOT EXISTS assigned_branch_ids
    JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_active
    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS company_id
    UUID;

-- ③ admins role constraint 재정의
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN (
    'super_admin',
    'manager',
    'director',
    'nutritionist'
  ));

-- ④ admins 논리 무결성 제약
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_scope_logic;
ALTER TABLE admins ADD CONSTRAINT admins_scope_logic CHECK (
  (diet_scope = 'ck' AND assigned_branch_ids = '[]'::jsonb)
  OR (diet_scope = 'consignment')
  OR diet_scope IS NULL
);

-- ⑤ branch_profiles 컬럼 추가
ALTER TABLE branch_profiles
  ADD COLUMN IF NOT EXISTS diet_type
    TEXT DEFAULT 'ck' CHECK (diet_type IN ('ck','consignment')),
  ADD COLUMN IF NOT EXISTS ck_location_id
    UUID REFERENCES ck_locations(id),
  ADD COLUMN IF NOT EXISTS review_required
    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_id
    UUID;

-- 기존 49개 CK 브랜치 → 1호점 연결
UPDATE branch_profiles
SET ck_location_id = (SELECT id FROM ck_locations WHERE name = '1호점')
WHERE diet_type = 'ck' OR diet_type IS NULL;

-- ⑥ [중요] 기존 review_request → generation_complete 변환 (Migration 안전)
UPDATE diet_review_items
SET status = 'generation_complete'
WHERE status = 'review_request';

-- diet_review_items status constraint 재정의
ALTER TABLE diet_review_items
  DROP CONSTRAINT IF EXISTS diet_review_items_status_check;
ALTER TABLE diet_review_items
  ADD CONSTRAINT diet_review_items_status_check
  CHECK (status IN (
    'generation_complete',
    'correction_request',
    'resubmitted',
    'approved',
    'deployed'
  ));

-- ⑦ diet_review_items 컬럼 추가
ALTER TABLE diet_review_items
  ADD COLUMN IF NOT EXISTS deployed_by    UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS deployed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;

-- ⑧ diet_notifications type constraint 재정의
--    review_request 유지 (하위호환)
ALTER TABLE diet_notifications
  DROP CONSTRAINT IF EXISTS diet_notifications_type_check;
ALTER TABLE diet_notifications
  ADD CONSTRAINT diet_notifications_type_check
  CHECK (type IN (
    'generation_complete',
    'review_request',
    'correction_request',
    'approved',
    'correction_to_nutritionist',
    'approved_to_nutritionist',
    'resubmitted_to_manager',
    'deployed_complete'
  ));

-- ⑨ 영양사 admins INSERT + Auth UID 연결
INSERT INTO admins (email, name, role, diet_scope, is_active)
VALUES ('sy226@kizmeal.com', '영양사', 'nutritionist', 'ck', true)
ON CONFLICT (email) DO UPDATE SET
  role       = 'nutritionist',
  diet_scope = 'ck',
  is_active  = true;

UPDATE admins
SET id = (SELECT id FROM auth.users WHERE email = 'sy226@kizmeal.com')
WHERE email = 'sy226@kizmeal.com'
  AND EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'sy226@kizmeal.com'
  );

-- ⑩ 최종 확인 쿼리
SELECT email, name, role, diet_scope, is_active
FROM admins ORDER BY role;
SELECT name, address FROM ck_locations;
