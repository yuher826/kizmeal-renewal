-- 1. brands 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. branches 테이블에 컬럼 추가
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_type TEXT DEFAULT 'franchise';
  -- 'franchise' | 'independent'
ALTER TABLE branches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  -- 'new' | 'active' | 'vacation' | 'expired' | 'inactive'
ALTER TABLE branches ADD COLUMN IF NOT EXISTS diet_type TEXT DEFAULT 'ck';
  -- 'ck' | 'catering'
ALTER TABLE branches ADD COLUMN IF NOT EXISTS meal_config JSONB DEFAULT '{}';
  -- {"오전": true, "오후": true, "방과후": false, "돌봄": false}
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contract_start DATE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS meal_count INTEGER DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES admins(id);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

-- 3. admin_branch_assignments (담당자 배정)
CREATE TABLE IF NOT EXISTS admin_branch_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id, branch_id)
);

-- 4. audit_logs (감사 로그)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- brands RLS
CREATE POLICY IF NOT EXISTS "brands_select_all" ON brands FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "brands_insert_admin" ON brands FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "brands_update_admin" ON brands FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid()));

-- admin_branch_assignments RLS
CREATE POLICY IF NOT EXISTS "aba_admin_only" ON admin_branch_assignments
  USING (EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid()));

-- audit_logs RLS
CREATE POLICY IF NOT EXISTS "audit_select_super" ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND role = 'super'));

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_brand_id ON branches(brand_id);
CREATE INDEX IF NOT EXISTS idx_branches_contract_end ON branches(contract_end);
CREATE INDEX IF NOT EXISTS idx_branches_must_change_password ON branches(must_change_password) WHERE must_change_password = true;
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
