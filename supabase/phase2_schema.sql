-- ============================================================
-- 키즈밀 1:1 게시판 Phase 2 — 추가 테이블 및 스키마 업데이트
-- phase1_schema.sql 실행 후 이 파일을 실행하세요
-- ============================================================

-- ============================================================
-- [0] inquiries 테이블 카테고리 업데이트 및 컬럼 추가
-- ============================================================

-- 카테고리 컬럼 제약조건 업데이트 (기존 제약 제거 후 재생성)
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;

ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_category_check
  CHECK (category IN (
    'MEAL_COUNT','ALLERGY','DELIVERY','MENU',
    'SCHEDULE','PHOTO','CONTRACT','OTHER',
    '운영','메뉴','서비스','시스템','기타'  -- 하위 호환
  ));

-- priority 컬럼 추가 (없으면)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS
  priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low','normal','high','urgent'));

-- form_data JSON 컬럼 추가 (동적 폼 응답 저장)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS
  form_data JSONB;

-- unread 카운터 컬럼 추가 (없으면)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS
  unread_count_branch INT NOT NULL DEFAULT 0;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS
  unread_count_admin  INT NOT NULL DEFAULT 0;

-- first_response_at 추가
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS
  first_response_at TIMESTAMPTZ;

-- ============================================================
-- [1] SLA 규칙 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS sla_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT        NOT NULL UNIQUE,
  response_hours   INT         NOT NULL,
  warning_hours    INT         NOT NULL,
  escalate_hours   INT         NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 SLA 데이터
INSERT INTO sla_rules (id, category, response_hours, warning_hours, escalate_hours) VALUES
  (gen_random_uuid(), 'MEAL_COUNT', 4,  3,  5),
  (gen_random_uuid(), 'ALLERGY',    4,  3,  5),
  (gen_random_uuid(), 'DELIVERY',   8,  6,  10),
  (gen_random_uuid(), 'MENU',       24, 20, 28),
  (gen_random_uuid(), 'SCHEDULE',   24, 20, 28),
  (gen_random_uuid(), 'PHOTO',      48, 36, 52),
  (gen_random_uuid(), 'CONTRACT',   48, 36, 52),
  (gen_random_uuid(), 'OTHER',      24, 20, 28)
ON CONFLICT (category) DO NOTHING;

-- ============================================================
-- [2] 내부 관리자 메모
-- ============================================================
CREATE TABLE IF NOT EXISTS inquiry_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  UUID        NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  admin_id    UUID        NOT NULL REFERENCES admins(id)    ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_notes_inquiry_id ON inquiry_notes(inquiry_id);

-- ============================================================
-- [3] 전화 처리 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       UUID        NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  admin_id         UUID        NOT NULL REFERENCES admins(id)    ON DELETE CASCADE,
  memo             TEXT,
  duration_minutes INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_logs_inquiry_id ON phone_logs(inquiry_id);

-- ============================================================
-- [4] 원아 알레르기 정보
-- ============================================================
CREATE TABLE IF NOT EXISTS allergy_records (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  child_name  TEXT        NOT NULL,
  birth_year  INT,
  allergens   TEXT[]      NOT NULL DEFAULT '{}',
  notes       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allergy_records_branch_id ON allergy_records(branch_id);

CREATE TRIGGER trg_allergy_records_updated_at
  BEFORE UPDATE ON allergy_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- [5] 동적 폼 필드 정의
-- ============================================================
CREATE TABLE IF NOT EXISTS form_field_definitions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT        NOT NULL,
  field_key   TEXT        NOT NULL,
  field_label TEXT        NOT NULL,
  field_type  TEXT        NOT NULL CHECK (field_type IN ('text','number','date','select','checkbox','textarea')),
  options     JSONB,
  is_required BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INT         NOT NULL DEFAULT 0,
  UNIQUE(category, field_key)
);

-- 동적 폼 초기 데이터
INSERT INTO form_field_definitions
  (id, category, field_key, field_label, field_type, options, is_required, sort_order)
VALUES
  -- 식수 변경
  (gen_random_uuid(),'MEAL_COUNT','current_count','현재 식수',     'number', null,                                              true,  1),
  (gen_random_uuid(),'MEAL_COUNT','new_count',    '변경 식수',     'number', null,                                              true,  2),
  (gen_random_uuid(),'MEAL_COUNT','change_date',  '변경 희망일',   'date',   null,                                              true,  3),
  -- 알레르기
  (gen_random_uuid(),'ALLERGY',   'child_name',   '원아 이름',     'text',   null,                                              true,  1),
  (gen_random_uuid(),'ALLERGY',   'allergens',    '알레르기 항목', 'checkbox','["달걀","우유","견과류","밀","새우","게","복숭아","기타"]', true,  2),
  (gen_random_uuid(),'ALLERGY',   'start_date',   '적용 시작일',   'date',   null,                                              true,  3),
  -- 배송/납품
  (gen_random_uuid(),'DELIVERY',  'item_name',    '품목',          'text',   null,                                              true,  1),
  (gen_random_uuid(),'DELIVERY',  'quantity',     '수량',          'number', null,                                              true,  2),
  (gen_random_uuid(),'DELIVERY',  'desired_date', '희망 수령일',   'date',   null,                                              true,  3),
  -- 일정 변경
  (gen_random_uuid(),'SCHEDULE',  'start_date',   '휴원 시작일',   'date',   null,                                              true,  1),
  (gen_random_uuid(),'SCHEDULE',  'end_date',     '휴원 종료일',   'date',   null,                                              true,  2),
  (gen_random_uuid(),'SCHEDULE',  'reason',       '사유',          'text',   null,                                              false, 3)
ON CONFLICT (category, field_key) DO NOTHING;

-- ============================================================
-- [6] 주간 리포트 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start         DATE        NOT NULL UNIQUE,
  total_inquiries    INT         NOT NULL DEFAULT 0,
  resolved_inquiries INT         NOT NULL DEFAULT 0,
  avg_response_hours NUMERIC,
  avg_satisfaction   NUMERIC,
  category_stats     JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE sla_rules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergy_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 정책
-- ============================================================

-- sla_rules: 누구나 조회 가능
CREATE POLICY "public_read_sla"   ON sla_rules         FOR SELECT USING (true);
CREATE POLICY "admin_write_sla"   ON sla_rules         FOR ALL    USING (is_admin());

-- form_field_definitions: 누구나 조회
CREATE POLICY "public_form_fields" ON form_field_definitions FOR SELECT USING (true);
CREATE POLICY "admin_write_forms"  ON form_field_definitions FOR ALL    USING (is_admin());

-- inquiry_notes: 관리자만
CREATE POLICY "admin_all_notes"   ON inquiry_notes     FOR ALL    USING (is_admin());

-- phone_logs: 관리자만
CREATE POLICY "admin_all_phone"   ON phone_logs        FOR ALL    USING (is_admin());

-- allergy_records: 본인 지점 + 관리자
CREATE POLICY "branch_own_allergy" ON allergy_records
  FOR ALL USING (branch_id = get_my_branch_id() OR is_admin());

-- weekly_reports: 관리자만
CREATE POLICY "admin_all_reports" ON weekly_reports    FOR ALL    USING (is_admin());

-- ============================================================
-- Supabase Storage 버킷
-- ============================================================
-- Supabase 대시보드 > Storage에서 수동으로 생성하거나 아래 SQL 실행:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('kizmeal-files', 'kizmeal-files', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS
-- CREATE POLICY "branch_upload" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'kizmeal-files' AND
--     (storage.foldername(name))[1] = get_my_branch_id()::text
--   );
-- CREATE POLICY "branch_read_own" ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'kizmeal-files' AND
--     (storage.foldername(name))[1] = get_my_branch_id()::text
--   );
-- CREATE POLICY "admin_read_all" ON storage.objects
--   FOR SELECT USING (bucket_id = 'kizmeal-files' AND is_admin());

-- ============================================================
-- messages 테이블 is_internal 컬럼 추가 (없으면)
-- ============================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- Supabase Realtime 활성화
-- ============================================================
-- Supabase 대시보드 > Database > Replication에서
-- messages, inquiries, notifications 테이블 활성화 필요

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE inquiries;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
