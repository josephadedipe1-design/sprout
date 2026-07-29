/*
# Add Sprout Team broadcast posts

1. New Columns
- `posts.is_official` (boolean, default false) — marks a post as an official
  Sprout Team announcement that bypasses the 10-mile radius filter and is
  visible to all users regardless of location.

2. New Data
- Inserts a "Sprout Team" system profile into `profiles` with first_name "Sprout",
  last_initial "T", bio "Official Sprout community updates", parent_type "parent".
  This profile acts as the author of official broadcast posts.
- The profile id (4848415f-2bbe-409a-8443-eb925b0b88e8) belongs to an existing
  real auth user account. This migration does NOT create an auth.users row —
  the account already exists and owns this profile.

3. Security (RLS)
- Replaces the existing INSERT and UPDATE policies on `posts` so that:
  - INSERT: only the admin user (4848415f-...) can set is_official = true.
    All other authenticated users can insert posts but only with is_official = false.
  - UPDATE: same restriction — only the admin user can create or change rows
    where is_official = true. Regular users can still update their own posts
    (author_id = auth.uid()) but cannot set is_official = true.
- SELECT and DELETE policies remain unchanged.

4. Important Notes
- The admin user ID 4848415f-2bbe-409a-8443-eb925b0b88e8 is the only account
  allowed to publish official announcements, enforced at the database level.
- Do NOT create an auth.users row here — that ID is a real existing account.
- All statements are idempotent (IF NOT EXISTS / ON CONFLICT / DROP IF EXISTS).
*/

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
