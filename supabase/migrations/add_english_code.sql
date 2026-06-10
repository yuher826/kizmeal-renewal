-- branch_profiles 테이블에 english_code 컬럼 추가
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS english_code text;
