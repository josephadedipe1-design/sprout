-- The admin profile id 4848415f-2bbe-409a-8443-eb925b0b88e8 belongs to an existing
-- real auth user account. Do NOT create an auth.users row.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

INSERT INTO profiles (id, first_name, last_initial, bio, parent_type, postcode, postcode_district)
VALUES (
  '4848415f-2bbe-409a-8443-eb925b0b88e8',
  'Sprout',
  'T',
  'Official Sprout community updates and announcements.',
  'parent',
  '',
  ''
)
ON CONFLICT (id) DO UPDATE SET
  first_name = 'Sprout',
  last_initial = 'T',
  bio = 'Official Sprout community updates and announcements.';

DROP POLICY IF EXISTS "posts_insert" ON posts;
CREATE POLICY "posts_insert" ON posts FOR INSERT
TO authenticated WITH CHECK (
  auth.uid() = author_id
  AND (is_official = false OR auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8')
);

DROP POLICY IF EXISTS "posts_update" ON posts;
CREATE POLICY "posts_update" ON posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (
  auth.uid() = author_id
  AND (is_official = false OR auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8')
);
