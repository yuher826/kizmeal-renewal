-- ============================================================
-- 키즈밀 1:1 게시판 Phase 1 — 테이블 생성 SQL
-- Supabase SQL Editor에서 한 번에 실행하세요
-- ============================================================

-- [0] UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- updated_at 자동 갱신 함수 (트리거 공용)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- [1] brands (브랜드)
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,                   -- 브랜드명
  code       TEXT        NOT NULL UNIQUE,            -- 브랜드 코드 (예: KIZMEAL)
  logo_url   TEXT,                                   -- 로고 이미지 URL
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  brands      IS '브랜드 정보 (예: 키즈밀, 아이캔밀)';
COMMENT ON COLUMN brands.code IS '브랜드 고유 코드';

CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [2] branches (가맹점 마스터 계정 — KOS ID 포함)
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id   UUID        NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  auth_id    UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL, -- Supabase Auth 연동
  kos_id     TEXT        NOT NULL UNIQUE,            -- KOS 가맹점 고유 ID
  name       TEXT        NOT NULL,                   -- 지점명 (예: 강남점)
  owner_name TEXT        NOT NULL,                   -- 대표자명
  email      TEXT        NOT NULL,
  phone      TEXT,                                   -- 연락처
  address    TEXT,                                   -- 주소
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  branches        IS '가맹점 마스터 계정';
COMMENT ON COLUMN branches.kos_id IS 'KOS 가맹점 고유 ID (로그인 ID로 사용 가능)';

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [3] branch_members (가맹점 서브계정 — 직원)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_members (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  auth_id    UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,                   -- 직원명
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'staff'    -- 역할
               CHECK (role IN ('manager', 'staff')),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  branch_members      IS '가맹점 서브계정 (직원)';
COMMENT ON COLUMN branch_members.role IS 'manager: 점장급, staff: 일반 직원';

CREATE TRIGGER trg_branch_members_updated_at
  BEFORE UPDATE ON branch_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [4] branch_invitations (서브계정 초대 토큰)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_invitations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,                  -- 초대받는 이메일
  token       TEXT        NOT NULL UNIQUE,           -- 고유 초대 토큰 (UUID 기반)
  role        TEXT        NOT NULL DEFAULT 'staff'
                CHECK (role IN ('manager', 'staff')),
  expires_at  TIMESTAMPTZ NOT NULL,                  -- 토큰 만료 시간 (보통 7일)
  accepted_at TIMESTAMPTZ,                           -- 수락 완료 시간 (NULL = 미수락)
  created_by  UUID        NOT NULL REFERENCES branches(id), -- 초대한 마스터 계정
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  branch_invitations         IS '서브계정 이메일 초대 토큰';
COMMENT ON COLUMN branch_invitations.token   IS '고유 초대 링크 토큰 (uuid_generate_v4())';
COMMENT ON COLUMN branch_invitations.expires_at IS '초대 만료 시각 (발급 후 7일 권장)';

-- ============================================================
-- [5] admins (키즈밀 내부 관리자)
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id    UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,                   -- 관리자 이름
  email      TEXT        NOT NULL UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'admin'
               CHECK (role IN ('super_admin', 'admin')),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  admins      IS '키즈밀 내부 관리자 계정';
COMMENT ON COLUMN admins.role IS 'super_admin: 전체 권한, admin: 일반 관리자';

CREATE TRIGGER trg_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [6] inquiries (1:1 문의 스레드)
-- ============================================================
CREATE TABLE IF NOT EXISTS inquiries (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         UUID        NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  category          TEXT        NOT NULL              -- 문의 분류
                      CHECK (category IN ('운영', '메뉴', '서비스', '시스템', '기타')),
  title             TEXT        NOT NULL,             -- 문의 제목
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  priority          TEXT        NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high')),
  assigned_admin_id UUID        REFERENCES admins(id) ON DELETE SET NULL, -- 담당 관리자
  created_by_type   TEXT        NOT NULL              -- 작성자 유형
                      CHECK (created_by_type IN ('branch', 'branch_member')),
  created_by_id     UUID        NOT NULL,             -- 작성자 ID (branches.id 또는 branch_members.id)
  last_message_at   TIMESTAMPTZ,                      -- 마지막 메시지 시간 (목록 정렬용)
  resolved_at       TIMESTAMPTZ,                      -- 해결 완료 시간
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  inquiries                IS '1:1 문의 스레드';
COMMENT ON COLUMN inquiries.status         IS 'pending:대기중 → in_progress:처리중 → resolved:해결됨 → closed:종료';
COMMENT ON COLUMN inquiries.priority       IS 'low:낮음, medium:보통, high:높음(긴급)';
COMMENT ON COLUMN inquiries.created_by_id IS 'branches.id 또는 branch_members.id (created_by_type에 따라 결정)';

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [7] messages (메시지)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_id  UUID        NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_type TEXT        NOT NULL                   -- 발신자 유형
                CHECK (sender_type IN ('branch', 'branch_member', 'admin')),
  sender_id   UUID        NOT NULL,                  -- 발신자 ID
  content     TEXT        NOT NULL,                  -- 메시지 본문
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,    -- 읽음 여부
  read_at     TIMESTAMPTZ,                           -- 읽은 시간
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE messages IS '1:1 문의 채팅 메시지';

CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [8] message_attachments (파일 첨부)
-- ============================================================
CREATE TABLE IF NOT EXISTS message_attachments (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name  TEXT        NOT NULL,                   -- 원본 파일명
  file_url   TEXT        NOT NULL,                   -- Supabase Storage URL
  file_size  INTEGER     NOT NULL,                   -- 파일 크기 (bytes)
  mime_type  TEXT        NOT NULL,                   -- MIME 타입 (예: image/jpeg)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  message_attachments          IS '메시지 파일 첨부';
COMMENT ON COLUMN message_attachments.file_url IS 'Supabase Storage 공개 URL';

-- ============================================================
-- [9] notifications (알림)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_type TEXT        NOT NULL               -- 수신자 유형
                   CHECK (recipient_type IN ('branch', 'branch_member', 'admin')),
  recipient_id   UUID        NOT NULL,              -- 수신자 ID
  inquiry_id     UUID        REFERENCES inquiries(id) ON DELETE CASCADE,
  message_id     UUID        REFERENCES messages(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL               -- 알림 종류
                   CHECK (type IN ('new_inquiry', 'new_message', 'status_changed', 'assigned')),
  title          TEXT        NOT NULL,              -- 알림 제목
  content        TEXT,                             -- 알림 본문 (선택)
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  notifications      IS '실시간 알림 (Supabase Realtime 연동)';
COMMENT ON COLUMN notifications.type IS 'new_inquiry:신규문의, new_message:새메시지, status_changed:상태변경, assigned:담당자배정';

-- ============================================================
-- [10] reply_templates (관리자 답변 템플릿)
-- ============================================================
CREATE TABLE IF NOT EXISTS reply_templates (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id   UUID        NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL                   -- 템플릿 분류
               CHECK (category IN ('운영', '메뉴', '서비스', '시스템', '기타')),
  title      TEXT        NOT NULL,                  -- 템플릿 제목
  content    TEXT        NOT NULL,                  -- 템플릿 본문
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reply_templates IS '관리자 빠른 답변 템플릿';

CREATE TRIGGER trg_reply_templates_updated_at
  BEFORE UPDATE ON reply_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 인덱스 (성능 최적화)
-- ============================================================

-- branches
CREATE INDEX IF NOT EXISTS idx_branches_brand_id  ON branches(brand_id);
CREATE INDEX IF NOT EXISTS idx_branches_auth_id   ON branches(auth_id);
CREATE INDEX IF NOT EXISTS idx_branches_kos_id    ON branches(kos_id);

-- branch_members
CREATE INDEX IF NOT EXISTS idx_branch_members_branch_id ON branch_members(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_members_auth_id   ON branch_members(auth_id);

-- branch_invitations
CREATE INDEX IF NOT EXISTS idx_branch_invitations_branch_id ON branch_invitations(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_invitations_token     ON branch_invitations(token);
CREATE INDEX IF NOT EXISTS idx_branch_invitations_email     ON branch_invitations(email);

-- admins
CREATE INDEX IF NOT EXISTS idx_admins_auth_id ON admins(auth_id);

-- inquiries
CREATE INDEX IF NOT EXISTS idx_inquiries_branch_id         ON inquiries(branch_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status            ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_admin_id ON inquiries(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_last_message_at   ON inquiries(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at        ON inquiries(created_at DESC);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_inquiry_id ON messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread     ON messages(inquiry_id, is_read) WHERE is_read = FALSE;

-- message_attachments
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(recipient_type, recipient_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- reply_templates
CREATE INDEX IF NOT EXISTS idx_reply_templates_admin_id  ON reply_templates(admin_id);
CREATE INDEX IF NOT EXISTS idx_reply_templates_category  ON reply_templates(category);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE brands              ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 헬퍼 함수
-- (SECURITY DEFINER → RLS 우회, SET search_path → 보안 강화)
-- ============================================================

-- 현재 유저가 활성 관리자인지 확인
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE auth_id = auth.uid() AND is_active = TRUE
  );
END;
$$;

-- 현재 유저의 branch_id 반환 (마스터 또는 서브계정 모두 처리)
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  -- 마스터 계정 확인
  SELECT id INTO v_branch_id
  FROM branches
  WHERE auth_id = auth.uid() AND is_active = TRUE
  LIMIT 1;

  -- 서브계정 확인
  IF v_branch_id IS NULL THEN
    SELECT branch_id INTO v_branch_id
    FROM branch_members
    WHERE auth_id = auth.uid() AND is_active = TRUE
    LIMIT 1;
  END IF;

  RETURN v_branch_id;
END;
$$;

-- 초대 토큰 검증 (비로그인 상태에서 호출 가능, SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION verify_invitation(p_token TEXT)
RETURNS TABLE (
  id          UUID,
  branch_id   UUID,
  email       TEXT,
  role        TEXT,
  expires_at  TIMESTAMPTZ,
  is_valid    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.id,
    bi.branch_id,
    bi.email,
    bi.role,
    bi.expires_at,
    (bi.accepted_at IS NULL AND bi.expires_at > NOW()) AS is_valid
  FROM branch_invitations bi
  WHERE bi.token = p_token;
END;
$$;

-- ============================================================
-- RLS 정책 — brands
-- ============================================================

-- 인증된 모든 유저 조회 가능
CREATE POLICY "brands_select" ON brands
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 관리자만 생성/수정/삭제
CREATE POLICY "brands_admin_all" ON brands
  FOR ALL
  USING (is_admin());

-- ============================================================
-- RLS 정책 — branches
-- ============================================================

-- 본인 지점 또는 관리자 조회
CREATE POLICY "branches_select" ON branches
  FOR SELECT
  USING (auth_id = auth.uid() OR is_admin());

-- 본인 지점 정보 수정 (전화번호, 주소 등)
CREATE POLICY "branches_update_own" ON branches
  FOR UPDATE
  USING (auth_id = auth.uid());

-- 관리자 전체 관리
CREATE POLICY "branches_admin_all" ON branches
  FOR ALL
  USING (is_admin());

-- ============================================================
-- RLS 정책 — branch_members
-- ============================================================

-- 같은 지점 멤버 조회
CREATE POLICY "branch_members_select" ON branch_members
  FOR SELECT
  USING (branch_id = get_my_branch_id() OR is_admin());

-- 마스터 계정이 서브계정 생성
CREATE POLICY "branch_members_insert" ON branch_members
  FOR INSERT
  WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- 본인 정보 수정 또는 마스터 계정이 자기 지점 멤버 수정
CREATE POLICY "branch_members_update" ON branch_members
  FOR UPDATE
  USING (
    auth_id = auth.uid()
    OR branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- 마스터 계정이 자기 지점 멤버 삭제
CREATE POLICY "branch_members_delete" ON branch_members
  FOR DELETE
  USING (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- ============================================================
-- RLS 정책 — branch_invitations
-- ============================================================

-- 마스터 계정이 본인 지점 초대 조회
CREATE POLICY "branch_invitations_select" ON branch_invitations
  FOR SELECT
  USING (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- 마스터 계정이 초대 생성
CREATE POLICY "branch_invitations_insert" ON branch_invitations
  FOR INSERT
  WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- 마스터 계정이 초대 취소/업데이트
CREATE POLICY "branch_invitations_update" ON branch_invitations
  FOR UPDATE
  USING (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- 마스터 계정이 초대 삭제
CREATE POLICY "branch_invitations_delete" ON branch_invitations
  FOR DELETE
  USING (
    branch_id IN (SELECT id FROM branches WHERE auth_id = auth.uid())
    OR is_admin()
  );

-- ============================================================
-- RLS 정책 — admins
-- ============================================================

-- 본인 계정 조회
CREATE POLICY "admins_select_self" ON admins
  FOR SELECT
  USING (auth_id = auth.uid());

-- 관리자끼리 전체 조회 (문의 배정 시 관리자 목록 필요)
CREATE POLICY "admins_select_all_admins" ON admins
  FOR SELECT
  USING (is_admin());

-- super_admin만 관리자 계정 관리
CREATE POLICY "admins_super_admin_all" ON admins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE auth_id = auth.uid() AND role = 'super_admin' AND is_active = TRUE
    )
  );

-- ============================================================
-- RLS 정책 — inquiries
-- ============================================================

-- 본인 지점 문의 조회 또는 관리자 전체 조회
CREATE POLICY "inquiries_select" ON inquiries
  FOR SELECT
  USING (branch_id = get_my_branch_id() OR is_admin());

-- 본인 지점 문의 생성
CREATE POLICY "inquiries_insert" ON inquiries
  FOR INSERT
  WITH CHECK (branch_id = get_my_branch_id());

-- 관리자만 상태/담당자 변경
CREATE POLICY "inquiries_update_admin" ON inquiries
  FOR UPDATE
  USING (is_admin());

-- 지점은 pending 상태일 때만 제목 수정 가능
CREATE POLICY "inquiries_update_branch_pending" ON inquiries
  FOR UPDATE
  USING (
    branch_id = get_my_branch_id() AND status = 'pending'
  );

-- ============================================================
-- RLS 정책 — messages
-- ============================================================

-- 해당 문의 참여자 조회
CREATE POLICY "messages_select" ON messages
  FOR SELECT
  USING (
    inquiry_id IN (
      SELECT id FROM inquiries WHERE branch_id = get_my_branch_id()
    )
    OR is_admin()
  );

-- 해당 문의 참여자 메시지 생성
CREATE POLICY "messages_insert" ON messages
  FOR INSERT
  WITH CHECK (
    inquiry_id IN (
      SELECT id FROM inquiries WHERE branch_id = get_my_branch_id()
    )
    OR is_admin()
  );

-- 관리자만 메시지 수정 (예: 부적절한 내용 삭제 처리)
CREATE POLICY "messages_update_admin" ON messages
  FOR UPDATE
  USING (is_admin());

-- ============================================================
-- RLS 정책 — message_attachments
-- ============================================================

-- 해당 메시지의 문의 참여자 조회
CREATE POLICY "message_attachments_select" ON message_attachments
  FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN inquiries i ON m.inquiry_id = i.id
      WHERE i.branch_id = get_my_branch_id()
    )
    OR is_admin()
  );

-- 해당 메시지 발신자 첨부 가능
CREATE POLICY "message_attachments_insert" ON message_attachments
  FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN inquiries i ON m.inquiry_id = i.id
      WHERE i.branch_id = get_my_branch_id()
    )
    OR is_admin()
  );

-- ============================================================
-- RLS 정책 — notifications
-- ============================================================

-- 본인 알림만 조회
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT
  USING (
    (recipient_type = 'branch'        AND recipient_id = (SELECT id FROM branches       WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'branch_member' AND recipient_id = (SELECT id FROM branch_members WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'admin'      AND recipient_id = (SELECT id FROM admins         WHERE auth_id = auth.uid() LIMIT 1))
  );

-- 본인 알림 읽음 처리
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE
  USING (
    (recipient_type = 'branch'        AND recipient_id = (SELECT id FROM branches       WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'branch_member' AND recipient_id = (SELECT id FROM branch_members WHERE auth_id = auth.uid() LIMIT 1))
    OR (recipient_type = 'admin'      AND recipient_id = (SELECT id FROM admins         WHERE auth_id = auth.uid() LIMIT 1))
  );

-- 알림 생성은 service_role(서버사이드)에서만 처리 — 별도 정책 불필요
-- (service_role은 RLS 자동 우회)

-- ============================================================
-- RLS 정책 — reply_templates
-- ============================================================

-- 관리자만 템플릿 조회/관리
CREATE POLICY "reply_templates_admin_all" ON reply_templates
  FOR ALL
  USING (is_admin());

-- ============================================================
-- 샘플 데이터 — brands (선택 사항, 필요시 실행)
-- ============================================================
-- INSERT INTO brands (name, code) VALUES
--   ('키즈밀', 'KIZMEAL'),
--   ('아이캔밀', 'ICANMEAL');
