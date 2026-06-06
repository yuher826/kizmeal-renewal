-- 1. branch_profiles 테이블
CREATE TABLE IF NOT EXISTS branch_profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id            uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  diet_plan_type       text NOT NULL DEFAULT 'CK'
                       CHECK (diet_plan_type IN ('CK', 'CONSIGNMENT')),
  snack_morning        boolean NOT NULL DEFAULT false,
  snack_afternoon      boolean NOT NULL DEFAULT false,
  snack_afterschool    boolean NOT NULL DEFAULT false,
  snack_childcare      boolean NOT NULL DEFAULT false,
  snack_teacher_extra  boolean NOT NULL DEFAULT false,
  custom_snack_slots   jsonb   NOT NULL DEFAULT '[]',
  nutritionist_name    text,
  nutritionist_email   text,
  distribution_email   text,
  special_notes        text,
  allergy_children     jsonb   NOT NULL DEFAULT '[]',
  pptx_template_id     text,
  memo                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_profiles_branch_id_key UNIQUE (branch_id)
);

-- 2. weekly_menus 테이블
-- week_num 기준: 해당 월 1일이 속한 주를 1주차로 산정
CREATE TABLE IF NOT EXISTS weekly_menus (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  upload_id    uuid REFERENCES diet_uploads(id) ON DELETE SET NULL,
  year         integer NOT NULL,
  month        integer NOT NULL,
  week_num     integer NOT NULL CHECK (week_num BETWEEN 1 AND 6),
  week_start   date,
  week_end     date,
  menu_data    jsonb,
  pdf_url      text,
  pptx_url     text,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','generated','distributed')),
  created_by   uuid REFERENCES admins(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_menus_unique UNIQUE (branch_id, year, month, week_num)
);

-- 3. updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_branch_profiles_updated_at ON branch_profiles;
CREATE TRIGGER update_branch_profiles_updated_at
  BEFORE UPDATE ON branch_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_menus_updated_at ON weekly_menus;
CREATE TRIGGER update_weekly_menus_updated_at
  BEFORE UPDATE ON weekly_menus
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. RLS
ALTER TABLE branch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menus    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_branch_profiles" ON branch_profiles;
CREATE POLICY "admins_all_branch_profiles" ON branch_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "branch_read_own_profile" ON branch_profiles;
CREATE POLICY "branch_read_own_profile" ON branch_profiles
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "admins_all_weekly_menus" ON weekly_menus;
CREATE POLICY "admins_all_weekly_menus" ON weekly_menus
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "branch_read_own_menus" ON weekly_menus;
CREATE POLICY "branch_read_own_menus" ON weekly_menus
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
  );
