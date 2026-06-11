-- diet_notifications type constraint에 emergency_deploy 추가
ALTER TABLE diet_notifications
  DROP CONSTRAINT IF EXISTS diet_notifications_type_check;
ALTER TABLE diet_notifications
  ADD CONSTRAINT diet_notifications_type_check
  CHECK (type IN (
    'upload_complete', 'review_request',
    'review_complete', 'correction_request',
    'approved', 'final_approved',
    'generation_complete', 'deployed',
    'pptx_error', 'email_bounce',
    'correction_to_nutritionist',
    'approved_to_nutritionist',
    'resubmitted_to_manager',
    'deployed_complete',
    'emergency_deploy'
  ));
