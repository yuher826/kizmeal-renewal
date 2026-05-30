-- =============================================
-- 학부모 포털 스키마
-- =============================================

-- 1. 학부모 테이블
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 원아(자녀) 테이블
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  name_ko TEXT NOT NULL,
  name_en TEXT,
  birth_date DATE,
  class_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 컨텐츠 테이블 (식단표/급식사진/레시피/공지)
CREATE TABLE IF NOT EXISTS contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  type TEXT NOT NULL CHECK (type IN ('menu', 'photo', 'recipe', 'notice')),
  title TEXT NOT NULL,
  body TEXT,
  date DATE,
  month TEXT,
  image_urls TEXT[],
  tags TEXT[],
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 학부모 알림 테이블
CREATE TABLE IF NOT EXISTS parent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 푸시 구독 테이블
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, endpoint)
);

-- =============================================
-- RLS 정책
-- =============================================

ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- parents: 본인 레코드만 읽기/수정, 관리자 전체 접근
CREATE POLICY "parents_select_own" ON parents
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "parents_insert_own" ON parents
  FOR INSERT WITH CHECK (auth_id = auth.uid());

CREATE POLICY "parents_update_own" ON parents
  FOR UPDATE USING (auth_id = auth.uid());

-- children: 본인 자녀만 접근
CREATE POLICY "children_select_own" ON children
  FOR SELECT USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

CREATE POLICY "children_insert_own" ON children
  FOR INSERT WITH CHECK (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

CREATE POLICY "children_update_own" ON children
  FOR UPDATE USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

-- contents: 가맹점 소속 학부모만 읽기
CREATE POLICY "contents_select_approved_parent" ON contents
  FOR SELECT USING (
    branch_id IN (
      SELECT c.branch_id FROM children c
      JOIN parents p ON p.id = c.parent_id
      WHERE p.auth_id = auth.uid() AND p.status = 'approved'
    )
  );

-- contents: 영양사(branch_member role=nutritionist)는 자기 가맹점 컨텐츠 관리
CREATE POLICY "contents_manage_nutritionist" ON contents
  FOR ALL USING (
    branch_id IN (
      SELECT bm.branch_id FROM branch_members bm
      WHERE bm.auth_id = auth.uid() AND bm.is_active = true
    )
  );

-- parent_notifications: 본인 것만
CREATE POLICY "parent_notifications_own" ON parent_notifications
  FOR ALL USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

-- push_subscriptions: 본인 것만
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

-- =============================================
-- 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS idx_parents_auth_id ON parents(auth_id);
CREATE INDEX IF NOT EXISTS idx_parents_status ON parents(status);
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_branch_id ON children(branch_id);
CREATE INDEX IF NOT EXISTS idx_contents_branch_type ON contents(branch_id, type);
CREATE INDEX IF NOT EXISTS idx_contents_date ON contents(date);
CREATE INDEX IF NOT EXISTS idx_contents_month ON contents(month);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent ON parent_notifications(parent_id, is_read);

-- =============================================
-- Realtime
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE parent_notifications;

-- =============================================
-- Storage bucket
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kizmeal-contents', 'kizmeal-contents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contents_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'kizmeal-contents');

CREATE POLICY "contents_nutritionist_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'kizmeal-contents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "contents_nutritionist_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'kizmeal-contents'
    AND auth.role() = 'authenticated'
  );
