-- weekly_menus에 JPG 파일 URL 컬럼 추가
ALTER TABLE weekly_menus
ADD COLUMN IF NOT EXISTS jpg_url TEXT;
