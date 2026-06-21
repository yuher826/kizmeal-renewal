-- weekly_menus.status constraint 에 'generating' 추가
-- 배경:
--   20260619000001 migration 에서 constraint 를 재정의할 때
--   'generating' 이 누락됨. trigger/route.ts 가 status = 'generating' 으로
--   업데이트하므로 constraint 위반 방지를 위해 추가.

ALTER TABLE weekly_menus
  DROP CONSTRAINT IF EXISTS weekly_menus_status_check;

ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'generating',
    'generation_complete',
    'approved',
    'deployed',
    'correction_requested',
    'error'
  ));
