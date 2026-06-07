-- 식단표 자동화 알림 테이블
CREATE TABLE IF NOT EXISTS diet_notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text        NOT NULL CHECK (type IN (
    'input_complete',
    'review_request',
    'correction_request',
    'approve_complete',
    'deploy_complete',
    'email_bounce',
    'email_resent',
    'pptx_failed',
    'pptx_retry_success',
    'receipt_confirmed',
    'urgent_change_request',
    'content_error_report'
  )),
  title           text        NOT NULL,
  message         text,
  branch_id       uuid        REFERENCES branches(id),
  weekly_menu_id  uuid        REFERENCES weekly_menus(id),
  year            integer,
  month           integer,
  is_read         boolean     DEFAULT false,
  recipient_role  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diet_notifications_recipient
ON diet_notifications(recipient_role, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diet_notifications_branch
ON diet_notifications(branch_id, created_at DESC);

-- RLS
ALTER TABLE diet_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diet_notifications_admin_only" ON diet_notifications;
CREATE POLICY "diet_notifications_admin_only"
ON diet_notifications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE auth_id = auth.uid() AND is_active = true
  )
);
