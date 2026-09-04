-- ★이 파일은 신규 변경이 아니라 "이미 DB에 실행 완료된 것"의 기록이다.
-- 2026-09-04 Supabase 대시보드에서 아래를 실행 완료했다. 지금 다시
-- 실행할 필요 없음 — 재실행해도 무해하도록 멱등 패턴(IF NOT EXISTS /
-- DROP CONSTRAINT IF EXISTS)으로 작성돼 있다.
--
-- 실측 확인 결과:
--   can_handle_cs         boolean  default false  NOT NULL
--   can_manage_templates  boolean  default false  NOT NULL   (기존)
--   can_write_notices     boolean  default false  NOT NULL
--   admins_role_check     ... 'staff' 포함 확인
-- 세 플래그가 형식까지 동일하다. 기존 6개 계정은 전부 false이므로
-- 이 SQL 자체로 새로 생기는 권한은 없다.

alter table admins add column if not exists can_handle_cs boolean not null default false;
alter table admins add column if not exists can_write_notices boolean not null default false;

alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check
  check (role in ('super_admin','manager','director',
                  'nutritionist_ck','nutritionist_consignment','staff'));
