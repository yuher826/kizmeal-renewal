ALTER TABLE branch_profiles
ADD COLUMN IF NOT EXISTS direct_delivery boolean DEFAULT false;
