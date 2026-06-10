-- ================================================================
-- weekly_menus RLS 정책 v2 — 역할별 접근 제어
--
-- Supabase SQL Editor 에서 한 번에 실행 (순서 중요)
--
-- 전제 조건:
--   admins.role IN ('super_admin','manager','nutritionist_ck','nutritionist_consignment')
--   admin_branch_assignments (admin_id, branch_id) — 위탁 영양사 ↔ 원 연결
--   weekly_menus.branch_id  IS NULL  → CK 공통 식단
--   weekly_menus.branch_id  IS NOT NULL → 원별 식단 (consignment)
-- ================================================================


-- ── STEP 0. branch_id NOT NULL 해제 ─────────────────────────────
-- 원래 테이블이 branch_id NOT NULL 로 생성되어 CK 공통 식단
-- (branch_id = null) INSERT 시 "new row violates row-level security policy"
-- 의 원인이 될 수 있음 → nullable 로 변경
ALTER TABLE weekly_menus ALTER COLUMN branch_id DROP NOT NULL;


-- ── STEP 1. 기존 정책 전부 삭제 ─────────────────────────────────
-- 역할 구분 없이 "모든 admin = ALL" 이던 구 정책 제거
DROP POLICY IF EXISTS "admins_all_weekly_menus"   ON weekly_menus;
DROP POLICY IF EXISTS "branch_read_own_menus"     ON weekly_menus;

-- 혹시 이전에 아래 이름으로 만들었을 경우도 대비
DROP POLICY IF EXISTS "wm_select_full_access"     ON weekly_menus;
DROP POLICY IF EXISTS "wm_select_consignment"     ON weekly_menus;
DROP POLICY IF EXISTS "wm_insert_full_access"     ON weekly_menus;
DROP POLICY IF EXISTS "wm_update_full_access"     ON weekly_menus;


-- ── STEP 2. 헬퍼 함수 ────────────────────────────────────────────
-- 매 정책 USING 절마다 서브쿼리를 반복하지 않도록 함수로 분리
-- SECURITY DEFINER: 함수 내에서는 테이블 소유자 권한으로 실행
--                   (RLS 루프 없이 admins 를 직접 읽음)
-- STABLE: 같은 트랜잭션 내에서 캐시됨 → 성능 최적화

CREATE OR REPLACE FUNCTION wm_get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM   admins
  WHERE  auth_id   = auth.uid()
    AND  is_active = true
  LIMIT  1;
$$;


-- ── STEP 3. SELECT 정책 ──────────────────────────────────────────

-- [A] super_admin / manager / nutritionist_ck
--     → branch_id 무관, 모든 행 조회 가능
CREATE POLICY "wm_select_full_access"
ON weekly_menus
FOR SELECT
USING (
  wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck')
);

-- [B] nutritionist_consignment
--     → admin_branch_assignments 에 등록된 본인 branch_id 행만 조회
--     → branch_id IS NULL (CK 공통) 행은 조회 불가
CREATE POLICY "wm_select_consignment"
ON weekly_menus
FOR SELECT
USING (
  wm_get_my_role() = 'nutritionist_consignment'
  AND branch_id IS NOT NULL
  AND branch_id IN (
    SELECT aba.branch_id
    FROM   admin_branch_assignments aba
    JOIN   admins a ON a.id = aba.admin_id
    WHERE  a.auth_id   = auth.uid()
      AND  a.is_active = true
  )
);


-- ── STEP 4. INSERT 정책 ──────────────────────────────────────────

-- super_admin / manager / nutritionist_ck 만 INSERT 가능
-- nutritionist_consignment 는 INSERT 불가
CREATE POLICY "wm_insert_full_access"
ON weekly_menus
FOR INSERT
WITH CHECK (
  wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck')
);


-- ── STEP 5. UPDATE 정책 ──────────────────────────────────────────

-- super_admin / manager / nutritionist_ck 만 UPDATE 가능
-- USING  : 업데이트 대상 행 조건
-- WITH CHECK : 업데이트 결과 행 조건 (둘 다 충족해야 통과)
CREATE POLICY "wm_update_full_access"
ON weekly_menus
FOR UPDATE
USING (
  wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck')
)
WITH CHECK (
  wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck')
);


-- ── STEP 6. (선택) branch_profiles 도 동일 패턴 적용 ────────────
-- branch_profiles 기존 정책도 역할 구분이 없음 → 필요 시 활성화

/*
DROP POLICY IF EXISTS "admins_all_branch_profiles" ON branch_profiles;
DROP POLICY IF EXISTS "branch_read_own_profile"    ON branch_profiles;

CREATE POLICY "bp_select_full_access"
ON branch_profiles FOR SELECT
USING ( wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck') );

CREATE POLICY "bp_select_consignment"
ON branch_profiles FOR SELECT
USING (
  wm_get_my_role() = 'nutritionist_consignment'
  AND branch_id IN (
    SELECT aba.branch_id
    FROM   admin_branch_assignments aba
    JOIN   admins a ON a.id = aba.admin_id
    WHERE  a.auth_id = auth.uid() AND a.is_active = true
  )
);

CREATE POLICY "bp_write_full_access"
ON branch_profiles FOR ALL
USING     ( wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck') )
WITH CHECK( wm_get_my_role() IN ('super_admin', 'manager', 'nutritionist_ck') );
*/


-- ── STEP 7. 결과 확인 ────────────────────────────────────────────
SELECT
  policyname,
  cmd,
  qual       AS using_expr,
  with_check AS check_expr
FROM pg_policies
WHERE tablename = 'weekly_menus'
ORDER BY cmd, policyname;
