-- diet_notifications.type CHECK constraint 통합 정리
-- 배경:
--   여러 마이그레이션 파일에서 constraint를 DROP/ADD 반복해
--   실제 어느 constraint가 DB에 적용됐는지 불명확한 상태.
--   이 파일로 최종 단일 기준을 확립한다.
--
-- 통일 원칙:
--   실제 코드에서 INSERT하는 신규 타입 우선 포함,
--   DB에 기존 데이터가 있을 수 있는 구버전 타입도 하위호환으로 유지.

ALTER TABLE diet_notifications
  DROP CONSTRAINT IF EXISTS diet_notifications_type_check;

ALTER TABLE diet_notifications
  ADD CONSTRAINT diet_notifications_type_check
  CHECK (type IN (
    -- 현재 코드에서 실제 INSERT하는 신규 타입
    'review_request',
    'generation_complete',
    'correction_to_nutritionist',
    'approved_to_nutritionist',
    'resubmitted_to_manager',
    'deployed_complete',
    'emergency_deploy',
    -- 하위호환 (구버전 타입 — DB에 기존 데이터 존재 가능)
    'input_complete',
    'review_complete',
    'correction_request',
    'approved',
    'final_approved',
    'deployed',
    'pptx_error',
    'email_bounce',
    'upload_complete',
    'approve_complete',
    'deploy_complete',
    'email_resent',
    'pptx_failed',
    'pptx_retry_success',
    'receipt_confirmed',
    'urgent_change_request',
    'content_error_report'
  ));
