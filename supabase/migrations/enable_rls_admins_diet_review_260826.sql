-- → 2026-08-26 Supabase kizmeal-renewal에서 실행 완료

-- admins: 정책 재귀 회피용 SECURITY DEFINER 헬퍼 함수
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins
    where auth_id = auth.uid()
      and role = 'super_admin'
      and is_active
  );
$$;

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from admins
  where auth_id = auth.uid()
    and is_active
  limit 1;
$$;

-- admins: 재귀 정책이던 admins_super_admin_all을 헬퍼 함수 기반으로 재생성
drop policy if exists admins_super_admin_all on public.admins;

create policy admins_super_admin_all on public.admins
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- diet_review_items: 컬럼 오류(admins.id) + 역할 누락을 고쳐 재생성
drop policy if exists admins_all on public.diet_review_items;

create policy diet_review_items_admin_access on public.diet_review_items
  for all
  using (
    public.current_admin_role() in (
      'super_admin', 'manager', 'director',
      'nutritionist_ck', 'nutritionist_consignment'
    )
  )
  with check (
    public.current_admin_role() in (
      'super_admin', 'manager',
      'nutritionist_ck', 'nutritionist_consignment'
    )
  );

-- 실제 RLS 활성화
alter table public.admins enable row level security;
alter table public.diet_review_items enable row level security;
