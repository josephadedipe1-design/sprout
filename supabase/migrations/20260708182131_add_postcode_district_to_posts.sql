ALTER TABLE posts ADD COLUMN IF NOT EXISTS postcode_district text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_posts_postcode_district ON posts(postcode_district);
