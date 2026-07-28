ALTER TABLE profiles DROP COLUMN IF EXISTS postcode_district;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS postcode_district TEXT NOT NULL DEFAULT '';
