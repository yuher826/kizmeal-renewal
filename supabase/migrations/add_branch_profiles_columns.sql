-- branch_profiles 테이블 신규 컬럼 추가 (IF NOT EXISTS 방식, 중복 오류 없음)

-- 기본정보
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS branch_full_name text;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS short_code text;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS group_tag text CHECK (group_tag IN ('E','P','R','SLP','MB','기타'));
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'active' CHECK (contract_status IN ('active','inactive'));
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS contract_start_date date;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS contract_renew_date date;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS inactive_reason text;

-- 파일설정
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS file_format text NOT NULL DEFAULT 'pdf' CHECK (file_format IN ('pdf','jpg','ppt','pdf+jpg'));
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS slide_count integer NOT NULL DEFAULT 1 CHECK (slide_count IN (1,2,3,4));
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS needs_english boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS english_name text;

-- 간식구성 (snack_morning 등 기존 컬럼은 이미 존재 — 새 컬럼만 추가)
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS snack_label text NOT NULL DEFAULT '오전간식/오후간식';
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS childcare_label text NOT NULL DEFAULT '돌봄';
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS morning_snack_fixed boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS morning_snack_fixed_menu text;

-- 특수처리
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS is_elan boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS is_ingpa boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS has_dessert_fruit boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS has_birthday_snack boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS has_health_booklet boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS has_yonder boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS yonder_name text;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS is_table_15row boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS direct_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS special_note text;

-- 배포설정 (기존 distribution_email 유지, 신규 배열 컬럼 별도 추가)
ALTER TABLE branch_profiles ADD COLUMN IF NOT EXISTS distribution_emails text[] DEFAULT '{}';
