-- ★이 파일은 신규 변경이 아니라 "이미 DB에 있는 것의 현행 스냅샷"이다.
-- 지금 DB에 다시 실행할 필요 없음.
--
-- 배경:
-- - 아래 함수 1개 + 정책 2개(is_admin, admins_select_all_admins,
--   admins_select_self)는 원래 DB에만 존재했고, 레포의 어느 마이그레이션
--   파일에도 없었다(2026-08-26 grep으로 확인 — 레포 전체에 정의 이력 없음)
-- - RLS가 꺼져 있던 동안에는(2026-08-25까지) 이 정책들이 실제로 적용되지
--   않았으므로 레포에 없어도 무해했다
-- - 2026-08-26 `enable_rls_admins_diet_review_260826.sql`로 admins의
--   RLS를 켜면서 상황이 바뀌었다: ★로그인이 이제 `admins_select_self`
--   정책에 전적으로 의존한다(RLS가 켜진 테이블은 정책이 없으면 아무 행도
--   안 보이므로, 이 정책이 없으면 아무도 자기 자신의 admins 행조차 못
--   읽어 로그인이 막힌다)
-- - 즉, 이 파일이 레포에 없는 상태로 DB를 재구축하면(마이그레이션을
--   순서대로 재실행하면) admins RLS를 켜는 순간 **전원 로그인 불가**가
--   된다. 이 파일은 그 재구축 시나리오에 대한 안전망으로 편입한다
--
-- 아래 원문은 2026-08-26 `pg_get_functiondef` / `pg_policies`로 DB에서
-- 그대로 조회한 내용이다. 새로 작성한 것이 아니다.

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE auth_id = auth.uid() AND is_active = TRUE
  );
END;
$function$;

drop policy if exists admins_select_all_admins on public.admins;
create policy admins_select_all_admins on public.admins
  for select
  using (public.is_admin());

drop policy if exists admins_select_self on public.admins;
create policy admins_select_self on public.admins
  for select
  using (auth_id = auth.uid());
