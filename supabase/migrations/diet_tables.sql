-- ============================================================
-- 식단표 자동화 마이그레이션
-- Supabase SQL Editor 또는 psql에서 실행
-- ============================================================

-- 1. branches 테이블에 profile_data JSONB 컬럼 추가
ALTER TABLE branches ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}';

-- 2. 엑셀 업로드 테이블
CREATE TABLE IF NOT EXISTS diet_uploads (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diet_type   TEXT NOT NULL CHECK (diet_type IN ('CK', '위탁')),
  year_month  TEXT NOT NULL,               -- e.g. '2026-07'
  file_name   TEXT,
  parsed_data JSONB DEFAULT '{}',          -- 파싱된 전체 메뉴 데이터
  status      TEXT DEFAULT 'uploaded',     -- uploaded | generating | generated | deployed
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 생성된 PDF 정보
CREATE TABLE IF NOT EXISTS diet_pdfs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id    UUID REFERENCES diet_uploads(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id)     ON DELETE CASCADE,
  branch_name  TEXT,
  year_month   TEXT NOT NULL,
  storage_path TEXT,
  file_url     TEXT,
  status       TEXT DEFAULT 'generated',    -- generated | deployed
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at  TIMESTAMPTZ,
  viewed_at    TIMESTAMPTZ
);

-- 4. 배포 이력
CREATE TABLE IF NOT EXISTS diet_deployments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id    UUID REFERENCES diet_uploads(id),
  year_month   TEXT NOT NULL,
  branch_count INT DEFAULT 0,
  deployed_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 수정 이력
CREATE TABLE IF NOT EXISTS diet_edit_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pdf_id     UUID REFERENCES diet_pdfs(id),
  branch_id  UUID REFERENCES branches(id),
  edited_by  UUID REFERENCES auth.users(id),
  changes    JSONB DEFAULT '{}',
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Storage 버킷 생성 (Supabase 대시보드 > Storage 에서도 가능)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('diet-pdfs', 'diet-pdfs', true)
-- ON CONFLICT (id) DO NOTHING;
