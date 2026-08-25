-- ============================================================
-- pptx 템플릿 버전 관리 마이그레이션
-- Supabase SQL Editor 에서 실행
-- ============================================================

-- 1. 템플릿 버전 관리 테이블
CREATE TABLE IF NOT EXISTS diet_templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version     INTEGER NOT NULL,
  name        TEXT NOT NULL,           -- "2026 키즈밀 디자인 v3"
  file_path   TEXT NOT NULL,           -- Supabase Storage 경로
  style_json  JSONB DEFAULT '{}',      -- 추출된 스타일 정보
  is_active   BOOLEAN DEFAULT false,   -- 현재 사용 중 여부
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  note        TEXT                     -- "헤더 색상 변경, 폰트 업데이트"
);

-- 2. 활성 템플릿은 1개만 허용 (트리거)
-- ⚠️ 이 트리거 함수는 2026-08-25에 대체되었다.
--    "테이블 전체에서 1개만 active" → "(org_id, year, month, vacation_variant)
--    조합 안에서만 1개만 active" 로 범위가 축소됨.
--    → supabase/migrations/fix_diet_templates_active_trigger_260824.sql 참조
--    이 파일의 아래 정의는 이력 보존용이며, 새 환경 구축 시 이 파일을
--    실행했다면 반드시 위 마이그레이션도 이어서 실행할 것.
--    (안 하면 방학O/X 템플릿 동시 active가 불가능해져 방학 배정 UI가 무력화됨)
CREATE OR REPLACE FUNCTION set_single_active_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE diet_templates
    SET is_active = false
    WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_active_template ON diet_templates;
CREATE TRIGGER ensure_single_active_template
  BEFORE INSERT OR UPDATE ON diet_templates
  FOR EACH ROW EXECUTE FUNCTION set_single_active_template();

-- 3. RLS 정책
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;

-- 관리자(admins 테이블에 있는 사용자)만 모든 작업 가능
CREATE POLICY "admin_all" ON diet_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_id = auth.uid()
        AND admins.is_active = true
    )
  );

-- 4. Supabase Storage 버킷 (대시보드 > Storage 에서 수동 생성 또는 아래 SQL 실행)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('diet-templates', 'diet-templates', false)
-- ON CONFLICT (id) DO NOTHING;
