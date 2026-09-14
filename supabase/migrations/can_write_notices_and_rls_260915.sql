-- ★이 파일은 신규 변경이 아니라 "이미 DB에 실행 완료된 것"의 기록이다.
-- 2026-09-15 Supabase 대시보드 SQL Editor에서 수동 실행 완료.
-- 멱등 패턴(CREATE OR REPLACE / DROP POLICY IF EXISTS)이라 재실행해도 무해하다.
--
-- 배경: 고객사 공지 쓰기가 UI·API·RLS 3층 모두 무방비였다(director·비활성
-- 계정도 작성·수정·삭제 가능). 화면 가드(canWriteNotices, lib/roles.ts:133)와
-- 이 DB 정책을 반드시 같은 기준으로 유지할 것.
--
-- ⚠️ 실측 기록(2026-09-15 pg_policies): notices_schema.sql:47-63의 원본은
-- 존재하지도 않는 board_users 테이블을 참조한다. 라이브는 admins 기준이었고
-- is_active·role 조건이 없었다. 파일이 아니라 pg_policies가 권위 있는 소스다.

-- ============================================================
-- 1) can_write_notices() 신설 — can_write_cs()와 같은 모양
--    ⚠️ 함수명과 admins 컬럼명이 같으므로 반드시 별칭(a.)으로 한정한다.
-- ============================================================
CREATE OR REPLACE FUNCTION can_write_notices()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins a
    WHERE a.auth_id = auth.uid()
      AND a.is_active = TRUE
      AND (a.role = 'super_admin' OR a.can_write_notices = TRUE)
  );
END;
$$;

-- ============================================================
-- 2) parent_notices — FOR ALL 단일 정책을 SELECT/쓰기로 분리
--    SELECT를 is_admin()으로 반드시 살린다. 안 그러면 director의
--    /erp/notices 열람(erp-access.ts:48-51에서 허용)이 같이 막힌다.
--    ⚠️ parent_notices_select / parent_notices_select_branch(학부모·
--    고객사용 SELECT)는 관심사가 달라 이번에 건드리지 않는다.
-- ============================================================
DROP POLICY IF EXISTS "admin_notices_all" ON parent_notices;

DROP POLICY IF EXISTS "notices_admin_select" ON parent_notices;
CREATE POLICY "notices_admin_select" ON parent_notices
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "notices_admin_insert" ON parent_notices;
CREATE POLICY "notices_admin_insert" ON parent_notices
  FOR INSERT WITH CHECK (can_write_notices());

DROP POLICY IF EXISTS "notices_admin_update" ON parent_notices;
CREATE POLICY "notices_admin_update" ON parent_notices
  FOR UPDATE USING (can_write_notices());

DROP POLICY IF EXISTS "notices_admin_delete" ON parent_notices;
CREATE POLICY "notices_admin_delete" ON parent_notices
  FOR DELETE USING (can_write_notices());

-- ============================================================
-- 3) parent_notice_reads — 관리자 정책도 같은 처방으로 교체
--    삭제 권한을 can_write_notices()로 맞추는 이유: /api/board/notices
--    DELETE가 reads를 먼저 지우고 공지를 지운다(103~112행). 두 기준이
--    다르면 "읽음 기록만 지워지고 공지는 남는" 부분 삭제가 난다.
--    조회(is_admin())는 원래 FOR ALL로 가능하던 것이라 기능 축소를
--    막기 위해 유지한다.
-- ============================================================
DROP POLICY IF EXISTS "admin_notice_reads_all" ON parent_notice_reads;

DROP POLICY IF EXISTS "notice_reads_admin_select" ON parent_notice_reads;
CREATE POLICY "notice_reads_admin_select" ON parent_notice_reads
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "notice_reads_admin_delete" ON parent_notice_reads;
CREATE POLICY "notice_reads_admin_delete" ON parent_notice_reads
  FOR DELETE USING (can_write_notices());

-- ============================================================
-- 4) parent_notice_reads — 본인 읽음 기록 정책 복원 (깨진 기능 수리)
--    notices_schema.sql:38-44에 설계돼 있었으나 라이브에서 증발한 상태.
--    RLS는 켜져 있어(2026-09-15 실측 rls_on=true) 고객사 포털의
--    읽음 SELECT·UPSERT가 전부 막히고 있었다.
--    ★UPDATE까지 만드는 이유 — board/customer/notices/page.tsx:88이
--    upsert(onConflict)라, 기존 행과 충돌하면 UPDATE 경로를 탄다.
--    INSERT/SELECT만 복원하면 그 경로에서 다시 조용히 실패한다.
-- ============================================================
DROP POLICY IF EXISTS "parent_notice_reads_select" ON parent_notice_reads;
CREATE POLICY "parent_notice_reads_select" ON parent_notice_reads
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "parent_notice_reads_insert" ON parent_notice_reads;
CREATE POLICY "parent_notice_reads_insert" ON parent_notice_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "parent_notice_reads_update" ON parent_notice_reads;
CREATE POLICY "parent_notice_reads_update" ON parent_notice_reads
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5) 적용 결과 확인
--    2026-09-15 실행 결과: 11행(parent_notices 6 + parent_notice_reads 5).
--    admin_notices_all·admin_notice_reads_all 두 개는 목록에서 사라졌고,
--    parent_notices_select·parent_notices_select_branch는 원문 그대로 유지됨을
--    확인했다.
-- ============================================================
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('parent_notices', 'parent_notice_reads')
ORDER BY tablename, policyname;
