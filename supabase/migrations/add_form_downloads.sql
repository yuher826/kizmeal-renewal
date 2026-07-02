-- 영양사 입력양식(빈폼) 다운로드 이력 추적
-- 방법B: 빈폼 파일은 Storage 경로규칙, 이 테이블은 다운로드 행위 기록만

CREATE TABLE IF NOT EXISTS form_downloads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid REFERENCES admins(id) ON DELETE CASCADE,
  year          int  NOT NULL,
  month         int  NOT NULL,
  storage_path  text NOT NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_downloads_ym    ON form_downloads(year, month);
CREATE INDEX IF NOT EXISTS idx_form_downloads_admin ON form_downloads(admin_id);

ALTER TABLE form_downloads ENABLE ROW LEVEL SECURITY;

-- 관례 통일: 활성 관리자면 전체 조회/삽입 허용 (기존 admin_only 패턴)
DROP POLICY IF EXISTS "form_downloads_admin_only" ON form_downloads;
CREATE POLICY "form_downloads_admin_only" ON form_downloads FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND is_active = true)
  );
