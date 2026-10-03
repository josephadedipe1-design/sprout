/*
# Add post creation rate limit (30-second cooldown)

## Purpose
Prevents users from creating more than one post every 30 seconds, reducing spam and rapid-fire posting.

## Changes
- Replaces the existing `posts_insert` INSERT policy on the `posts` table.
- The previous policy checked: `auth.uid() = author_id AND (is_official = false OR auth.uid() = '4848415f-...')`.
- The new policy preserves ALL existing logic and adds a rate-limit condition:
  the user must NOT have created a post in the last 30 seconds (checked via a
  subquery against posts where author_id = auth.uid() and created_at > now() - interval '30 seconds').
- This rate limit applies ONLY to posts — not to replies, listings, or messages.

## Security
- RLS on posts remains enabled.
- The INSERT policy is still scoped to `authenticated` users.
- Ownership check (auth.uid() = author_id) is preserved.
- Official-post guard (is_official = false OR auth.uid() = sprout team admin) is preserved.
- Rate-limit subquery uses the same ownership column (author_id) and is evaluated server-side.

## Important Notes
1. The `posts_delete_own` DELETE policy is NOT touched.
2. The `posts_select` and `posts_update` policies are NOT touched.
3. This is a DROP + CREATE of `posts_insert` only — safe to re-run (idempotent).
4. The rate limit is enforced at the database level via RLS, so it cannot be bypassed by any client.
*/

DROP POLICY IF EXISTS "posts_insert" ON posts;

CREATE POLICY "posts_insert"
ON posts FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = author_id)
  AND ((is_official = false) OR (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid))
  AND NOT EXISTS (
    SELECT 1 FROM posts p
    WHERE p.author_id = auth.uid()
      AND p.created_at > now() - interval '30 seconds'
  )
);
