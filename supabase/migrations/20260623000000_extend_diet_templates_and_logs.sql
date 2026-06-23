-- diet_templates 자동생성 연결 확장 + 템플릿 이력(감사 로그) 테이블
-- 기존 PDF 스타일 추출 기능은 그대로 유지

-- ════════════════════════════════════════════
-- 1. diet_templates 컬럼 추가 (자동생성 엔진 연결용)
-- ════════════════════════════════════════════

-- 1-1. 적용 연/월
ALTER TABLE diet_templates
  ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE diet_templates
  ADD COLUMN IF NOT EXISTS month INTEGER;

-- 1-2. 적용 그룹 (branch_profiles.group_tag 값 + ALL=전체공통)
ALTER TABLE diet_templates
  ADD COLUMN IF NOT EXISTS group_tag TEXT DEFAULT 'ALL'
  CHECK (group_tag IN ('ALL','E','P','R','SLP','MB','기타'));

-- 1-3. 이름표 검증 결과 (이름표 4개 + 표 구조 호환성)
ALTER TABLE diet_templates
  ADD COLUMN IF NOT EXISTS validation_result JSONB DEFAULT '{}';

-- 1-4. 멀티테넌시 대비 (지금은 키즈밀 1개 org, 자리만 확보)
ALTER TABLE diet_templates
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- 1-5. 조회 성능 인덱스 (year, month, group_tag 조합으로 자주 검색)
CREATE INDEX IF NOT EXISTS idx_diet_templates_ym_group
  ON diet_templates (year, month, group_tag);

-- ════════════════════════════════════════════
-- 2. template_logs 이력 테이블 (감사 로그)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS template_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES diet_templates(id) ON DELETE SET NULL,
  org_id      UUID,
  action      TEXT NOT NULL
              CHECK (action IN ('upload','generate','rollback','delete','validate_fail')),
  actor       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detail      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2-1. 이력 조회 인덱스 (특정 템플릿의 이력을 시간순으로)
CREATE INDEX IF NOT EXISTS idx_template_logs_template
  ON template_logs (template_id, created_at DESC);

-- 2-2. RLS: 관리자만 접근 (diet_templates의 admin_all과 동일 패턴)
ALTER TABLE template_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON template_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_id = auth.uid()
        AND admins.is_active = true
    )
  );
