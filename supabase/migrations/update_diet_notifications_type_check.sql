-- diet_notifications.type CHECK에 'review_complete', 'final_approved', 'deployed' 추가
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
    'generation_complete',
    'review_complete',
    'final_approved',
    'deployed'
  ));
