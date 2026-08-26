-- 조회 전용 검증 스크립트. DB를 변경하지 않는다.
-- enable_rls_admins_diet_review_260826.sql 적용 결과를 확인하기 위해
-- 2026-08-26 작성. 각 쿼리 위 주석에 "정상"으로 나와야 할 결과를 적어둔다.

-- ① admins / diet_review_items 의 RLS 활성화 여부 확인
--    정상: 두 행 모두 relrowsecurity = true
select relname, relrowsecurity
from pg_class
where relname in ('admins', 'diet_review_items')
  and relnamespace = 'public'::regnamespace;

-- ② 두 테이블에 걸린 정책 전체 조회
--    정상: 총 4건 — admins 3건(admins_super_admin_all,
--    admins_select_all_admins, admins_select_self) + diet_review_items
--    1건(diet_review_items_admin_access). qual/with_check 어디에도
--    'FROM admins' 서브쿼리 문자열이 없어야 한다(= 재귀 정책 완전 제거 확인)
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('admins', 'diet_review_items')
order by tablename, policyname;

-- ③ 헬퍼 함수 3종이 전부 SECURITY DEFINER인지 확인
--    정상: prosecdef 셋 다 true (is_admin, is_super_admin, current_admin_role)
select proname, prosecdef
from pg_proc
where proname in ('is_admin', 'is_super_admin', 'current_admin_role')
  and pronamespace = 'public'::regnamespace;

-- ④ 트랜잭션 안에서 실제 RLS 동작 시험 (커밋 없이 즉시 ROLLBACK, DB에 안 남음)
--    ★ auth_id는 반드시 아래 플레이스홀더를 지우고 실행 시점에 채울 것.
--      admins 테이블에서 본인(또는 시험 대상) 계정의 auth_id를 직접 조회해
--      채워 넣는다. 이 저장소는 공개 상태라 실제 UUID를 파일에 남기지 않는다.
--    정상: 로그인 가능한 활성 관리자 계정이면 admins/diet_review_items
--      count(*)가 0이 아니어야 한다(역할에 따라 diet_review_items는
--      0일 수 있음 — admins 쪽이 0이면 로그인 자체가 막힌 것이므로 이상 신호)
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<여기에 시험할 계정의 auth_id를 채울 것>"}';

  select count(*) from admins;
  select count(*) from diet_review_items;
rollback;
