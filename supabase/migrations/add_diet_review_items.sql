-- ── 1. admins.role에 director 추가 ──────────────────────────────
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN (
    'super_admin',
    'manager',
    'director',
    'nutritionist_ck',
    'nutritionist_consignment'
  ));

-- ── 2. diet_review_items 생성 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS diet_review_items (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_menu_id   uuid        NOT NULL REFERENCES weekly_menus(id) ON DELETE CASCADE,
  branch_id        uuid        REFERENCES branches(id),
  branch_name      text        NOT NULL,
  pptx_url         text,
  jpg_url          text,
  review_status    text        NOT NULL DEFAULT 'pending'
                   CHECK (review_status IN ('pending', 'approved', 'correction_requested')),
  memo             text,
  memo_category    text,
  correction_count integer     NOT NULL DEFAULT 0,
  memo_history     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by      uuid        REFERENCES admins(id),
  reviewed_at      timestamptz,
  approved_by      uuid        REFERENCES admins(id),
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS diet_review_items_menu_branch_unique
  ON diet_review_items(weekly_menu_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_diet_review_items_menu
  ON diet_review_items(weekly_menu_id);

CREATE INDEX IF NOT EXISTS idx_diet_review_items_branch
  ON diet_review_items(branch_id);

ALTER TABLE diet_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diet_review_items_admin_only" ON diet_review_items;
CREATE POLICY "diet_review_items_admin_only" ON diet_review_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true
  )
);

-- ── 3. diet_notifications type 확장 ──────────────────────────────
ALTER TABLE diet_notifications DROP CONSTRAINT IF EXISTS diet_notifications_type_check;
ALTER TABLE diet_notifications
  ADD CONSTRAINT diet_notifications_type_check
  CHECK (type IN (
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
    'content_error_report',
    'review_complete',
    'final_approved',
    'generation_complete'
  ));
