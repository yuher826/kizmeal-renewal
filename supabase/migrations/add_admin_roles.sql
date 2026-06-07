-- admins 테이블 role 컬럼 추가
ALTER TABLE admins ADD COLUMN IF NOT EXISTS
  role text NOT NULL DEFAULT 'manager'
  CHECK (role IN (
    'super_admin',
    'manager',
    'nutritionist_ck',
    'nutritionist_consignment'
  ));

-- 위탁 영양사 전용 다중 원 연결 테이블
CREATE TABLE IF NOT EXISTS admin_branch_assignments (
  admin_id  uuid REFERENCES admins(id)    ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id)  ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (admin_id, branch_id)
);

-- RLS
ALTER TABLE admin_branch_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_branch_assignments_admin_only" ON admin_branch_assignments;
CREATE POLICY "admin_branch_assignments_admin_only"
ON admin_branch_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_id = auth.uid() AND is_active = true
  )
);
