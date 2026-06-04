-- ============================================================
-- 문의 3종 분리 개편 마이그레이션
--   1) 학부모 문의 테이블 신규 (parent_inquiries / parent_inquiry_messages)
--   2) 운영 문의(inquiries)에 컴플레인(COMPLAINT) 카테고리 허용
--
-- 실행 순서: phase1/phase2/phase3 + parent_schema 이후 마지막에 실행.
-- 서비스 문의(public_inquiries)는 기존 스키마를 그대로 재사용하므로 변경 없음.
-- ============================================================

-- ── update_updated_at() 가 없을 경우를 대비 (phase1에서 생성됨) ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- [1] 운영 문의: 컴플레인 카테고리 허용
--     기존 category CHECK 제약을 제거해 앱에서 보내는 카테고리 코드를
--     (DELIVERY/MENU/STAFF_MEAL/HYGIENE/CONTRACT/OTHER/COMPLAINT 등) 자유롭게 허용.
-- ============================================================
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;

-- ============================================================
-- [2] 학부모 문의 (parent_inquiries)
-- ============================================================
CREATE TABLE IF NOT EXISTS parent_inquiries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  child_id            UUID          REFERENCES children(id)  ON DELETE SET NULL,
  branch_id           UUID          REFERENCES branches(id)  ON DELETE SET NULL,
  category            TEXT NOT NULL DEFAULT 'GENERAL'
                        CHECK (category IN ('ALLERGY', 'MENU', 'PHOTO', 'COMPLAINT', 'GENERAL')),
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  last_message_at     TIMESTAMPTZ,
  unread_count_parent INT  NOT NULL DEFAULT 0,
  unread_count_admin  INT  NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE parent_inquiries IS '학부모 포털 1:1 문의 (급식 관련)';

DROP TRIGGER IF EXISTS trg_parent_inquiries_updated_at ON parent_inquiries;
CREATE TRIGGER trg_parent_inquiries_updated_at
  BEFORE UPDATE ON parent_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [3] 학부모 문의 메시지 (parent_inquiry_messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS parent_inquiry_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  UUID NOT NULL REFERENCES parent_inquiries(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'admin', 'system')),
  sender_id   UUID,                                  -- auth.users.id (system 메시지는 NULL)
  content     TEXT NOT NULL,
  image_urls  TEXT[],                                -- 첨부 사진 공개 URL (최대 3장)
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE parent_inquiry_messages IS '학부모 문의 채팅 메시지';

-- ============================================================
-- [4] 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_parent_inquiries_parent  ON parent_inquiries(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_inquiries_branch  ON parent_inquiries(branch_id);
CREATE INDEX IF NOT EXISTS idx_parent_inquiries_status  ON parent_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_parent_inquiries_category ON parent_inquiries(category);
CREATE INDEX IF NOT EXISTS idx_parent_inq_msg_inquiry   ON parent_inquiry_messages(inquiry_id);

-- ============================================================
-- [5] RLS
-- ============================================================
ALTER TABLE parent_inquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_inquiry_messages  ENABLE ROW LEVEL SECURITY;

-- 학부모: 본인 문의만 SELECT / INSERT / UPDATE
DROP POLICY IF EXISTS "parent_inq_select_own" ON parent_inquiries;
CREATE POLICY "parent_inq_select_own" ON parent_inquiries
  FOR SELECT USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "parent_inq_insert_own" ON parent_inquiries;
CREATE POLICY "parent_inq_insert_own" ON parent_inquiries
  FOR INSERT WITH CHECK (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "parent_inq_update_own" ON parent_inquiries;
CREATE POLICY "parent_inq_update_own" ON parent_inquiries
  FOR UPDATE USING (
    parent_id IN (SELECT id FROM parents WHERE auth_id = auth.uid())
  );

-- 관리자: 전체 접근
DROP POLICY IF EXISTS "parent_inq_admin_all" ON parent_inquiries;
CREATE POLICY "parent_inq_admin_all" ON parent_inquiries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );

-- 메시지 — 학부모: 본인 문의의 메시지만
DROP POLICY IF EXISTS "parent_inq_msg_select_own" ON parent_inquiry_messages;
CREATE POLICY "parent_inq_msg_select_own" ON parent_inquiry_messages
  FOR SELECT USING (
    inquiry_id IN (
      SELECT pi.id FROM parent_inquiries pi
      JOIN parents p ON p.id = pi.parent_id
      WHERE p.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "parent_inq_msg_insert_own" ON parent_inquiry_messages;
CREATE POLICY "parent_inq_msg_insert_own" ON parent_inquiry_messages
  FOR INSERT WITH CHECK (
    sender_type = 'parent'
    AND inquiry_id IN (
      SELECT pi.id FROM parent_inquiries pi
      JOIN parents p ON p.id = pi.parent_id
      WHERE p.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "parent_inq_msg_update_own" ON parent_inquiry_messages;
CREATE POLICY "parent_inq_msg_update_own" ON parent_inquiry_messages
  FOR UPDATE USING (
    inquiry_id IN (
      SELECT pi.id FROM parent_inquiries pi
      JOIN parents p ON p.id = pi.parent_id
      WHERE p.auth_id = auth.uid()
    )
  );

-- 메시지 — 관리자: 전체 접근
DROP POLICY IF EXISTS "parent_inq_msg_admin_all" ON parent_inquiry_messages;
CREATE POLICY "parent_inq_msg_admin_all" ON parent_inquiry_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
  );

-- ============================================================
-- [6] Realtime
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE parent_inquiries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE parent_inquiry_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;
