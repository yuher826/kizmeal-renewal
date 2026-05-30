-- ============================================================
-- Phase 3: Schema fixes and missing columns
-- Run after phase1_schema.sql and phase2_schema.sql
-- ============================================================

-- ── messages: make sender_id nullable + add 'system' type ──────
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check
  CHECK (sender_type IN ('branch', 'branch_member', 'admin', 'system'));

-- ── branches: add missing columns ─────────────────────────────
ALTER TABLE branches ADD COLUMN IF NOT EXISTS region        TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS tier          TEXT DEFAULT 'standard';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contract_start DATE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contract_end   DATE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS meal_count     INT  DEFAULT 0;

-- ── admins: add missing columns ───────────────────────────────
ALTER TABLE admins ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone      TEXT;

-- ── inquiries: add brand_id, closed_at ────────────────────────
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS brand_id  UUID REFERENCES brands(id) ON DELETE RESTRICT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ── message_attachments: add storage_path + file_type ─────────
ALTER TABLE message_attachments ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE message_attachments ADD COLUMN IF NOT EXISTS file_type    TEXT;
ALTER TABLE message_attachments ALTER COLUMN file_url   DROP NOT NULL;
ALTER TABLE message_attachments ALTER COLUMN mime_type  DROP NOT NULL;

-- ── reply_templates: make admin_id optional, add new columns ──
ALTER TABLE reply_templates ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE reply_templates DROP CONSTRAINT IF EXISTS reply_templates_category_check;
ALTER TABLE reply_templates ADD COLUMN IF NOT EXISTS brand_id   UUID REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE reply_templates ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0;
ALTER TABLE reply_templates ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES admins(id);

-- ── notifications: add recipient_auth_id + body ───────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_auth_id UUID REFERENCES auth.users(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body              TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_auth_id
  ON notifications(recipient_auth_id) WHERE is_read = FALSE;

-- Update SELECT policy to use recipient_auth_id
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT
  USING (
    recipient_auth_id = auth.uid()
    OR (recipient_type = 'branch'        AND recipient_id = (SELECT id FROM branches       WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'branch_member' AND recipient_id = (SELECT id FROM branch_members WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'admin'         AND recipient_id = (SELECT id FROM admins         WHERE auth_id = auth.uid() LIMIT 1))
  );

-- Update UPDATE policy
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE
  USING (
    recipient_auth_id = auth.uid()
    OR (recipient_type = 'branch'        AND recipient_id = (SELECT id FROM branches       WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'branch_member' AND recipient_id = (SELECT id FROM branch_members WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'admin'         AND recipient_id = (SELECT id FROM admins         WHERE auth_id = auth.uid() LIMIT 1))
  );

-- ── inquiries RLS: allow branch to update its own inquiries ───
DROP POLICY IF EXISTS "inquiries_update_branch_pending" ON inquiries;
CREATE POLICY "inquiries_update_branch_own" ON inquiries
  FOR UPDATE
  USING (branch_id = get_my_branch_id());

-- ── DB Trigger: auto-create notification on admin reply ────────
CREATE OR REPLACE FUNCTION notify_branch_on_admin_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_auth_id UUID;
  v_branch_id      UUID;
BEGIN
  IF NEW.sender_type = 'admin' AND NEW.is_internal = FALSE THEN
    SELECT b.auth_id, b.id
      INTO v_branch_auth_id, v_branch_id
      FROM inquiries i
      JOIN branches b ON b.id = i.branch_id
     WHERE i.id = NEW.inquiry_id
     LIMIT 1;

    IF v_branch_auth_id IS NOT NULL THEN
      INSERT INTO notifications (
        recipient_auth_id, recipient_type, recipient_id,
        inquiry_id, message_id, type, title, body, is_read
      ) VALUES (
        v_branch_auth_id,
        'branch',
        v_branch_id,
        NEW.inquiry_id,
        NEW.id,
        'new_message',
        '새 답변이 도착했습니다 💬',
        LEFT(NEW.content, 80),
        FALSE
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_branch_on_admin_reply ON messages;
CREATE TRIGGER trg_notify_branch_on_admin_reply
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_branch_on_admin_reply();

-- ── Add Realtime if not already ───────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE inquiries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;
