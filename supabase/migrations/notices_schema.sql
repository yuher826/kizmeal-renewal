CREATE TABLE IF NOT EXISTS parent_notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text,
  branch_id uuid REFERENCES branches(id),
  is_pinned boolean DEFAULT false,
  created_by uuid,
  attachment_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parent_notice_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id uuid REFERENCES parent_notices(id),
  user_id uuid,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notice_id, user_id)
);

-- RLS
ALTER TABLE parent_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_notice_reads ENABLE ROW LEVEL SECURITY;

-- 학부모: 자기 branch_id 공지 + 전체(NULL) 공지만 SELECT
CREATE POLICY "parent_notices_select" ON parent_notices
  FOR SELECT
  USING (
    branch_id IS NULL
    OR branch_id IN (
      SELECT c.branch_id
      FROM children c
      JOIN parents p ON p.id = c.parent_id
      WHERE p.auth_id = auth.uid()
    )
  );

-- 학부모: 자기 읽음 기록만 INSERT/SELECT
CREATE POLICY "parent_notice_reads_insert" ON parent_notice_reads
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "parent_notice_reads_select" ON parent_notice_reads
  FOR SELECT
  USING (user_id = auth.uid());

-- 관리자: 전체 CRUD
CREATE POLICY "admin_notices_all" ON parent_notices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_users bu
      WHERE bu.auth_id = auth.uid()
      AND bu.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admin_notice_reads_all" ON parent_notice_reads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_users bu
      WHERE bu.auth_id = auth.uid()
      AND bu.role IN ('admin', 'super_admin')
    )
  );
