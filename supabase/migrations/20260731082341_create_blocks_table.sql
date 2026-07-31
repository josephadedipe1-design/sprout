/*
# Create blocks table + mutual invisibility RLS

## 1. New Table: blocks
- blocker_id, blocked_id, created_at, unique constraint on (blocker_id, blocked_id)

## 2. Helper Function: is_blocked(user_a, user_b)
SECURITY DEFINER function returning true if either user has blocked the other.

## 3. RLS on blocks
- SELECT/INSERT/DELETE restricted to blocker_id = auth.uid()

## 4. Updated RLS on existing tables (mutual invisibility)
Drops and replaces the ACTUAL existing policy names on profiles, posts, listings,
conversations, match_requests, and messages (verified against the live database
before writing this migration), preserving each policy's original visibility logic
and adding the block-exclusion check on top.

## 5. Legacy cleanup
Drops messages_own_read / messages_own_write — unused legacy policies based on a
conversation_members table that isn't referenced anywhere in the app codebase.
These created a bypass around the block check, since Postgres OR's together
multiple permissive policies on the same table.
*/

-- ─── BLOCKS TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select_own" ON blocks;
CREATE POLICY "blocks_select_own" ON blocks FOR SELECT
  TO authenticated USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON blocks;
CREATE POLICY "blocks_insert_own" ON blocks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON blocks;
CREATE POLICY "blocks_delete_own" ON blocks FOR DELETE
  TO authenticated USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);

-- ─── HELPER FUNCTION: mutual block check ─────────────────────────────────────
CREATE OR REPLACE FUNCTION is_blocked(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

REVOKE ALL ON FUNCTION is_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_blocked(uuid, uuid) TO authenticated;

-- ─── PROFILES: mutual invisibility ──────────────────────────────────────────
-- Original policy: profiles_public_read, qual = true (everyone visible)
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR NOT is_blocked(auth.uid(), id)
  );

-- ─── POSTS: mutual invisibility ──────────────────────────────────────────────
-- Original policy: posts_public_read, qual = status = 'active'
DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (auth.uid() = author_id OR NOT is_blocked(auth.uid(), author_id))
  );

-- ─── LISTINGS: mutual invisibility ───────────────────────────────────────────
-- Original policy: listings_read, qual = true
DROP POLICY IF EXISTS "listings_read" ON listings;
CREATE POLICY "listings_read" ON listings FOR SELECT TO authenticated
  USING (
    auth.uid() = seller_id
    OR NOT is_blocked(auth.uid(), seller_id)
  );

-- ─── CONVERSATIONS: mutual invisibility ─────────────────────────────────────
-- Original policy: conversations_read, qual = user1_id/user2_id match
DROP POLICY IF EXISTS "conversations_read" ON conversations;
CREATE POLICY "conversations_read" ON conversations FOR SELECT TO authenticated
  USING (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND NOT is_blocked(user1_id, user2_id)
  );

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND NOT is_blocked(user1_id, user2_id)
  );

-- ─── MESSAGES: prevent sending to a blocked user ─────────────────────────────
-- Remove legacy/unused policies based on the old conversation_members table
-- (confirmed unused anywhere in the app codebase) — these created a bypass
-- around the block check, since Postgres OR's multiple permissive policies.
DROP POLICY IF EXISTS "messages_own_read" ON messages;
DROP POLICY IF EXISTS "messages_own_write" ON messages;

DROP POLICY IF EXISTS "messages_read" ON messages;
CREATE POLICY "messages_read" ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT is_blocked(c.user1_id, c.user2_id)
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT is_blocked(c.user1_id, c.user2_id)
    )
  );

-- ─── MATCH_REQUESTS: mutual invisibility + prevent new requests ──────────────
-- Original policies confirmed: match_requests_recipient_read (SELECT),
-- match_requests_insert (INSERT), match_requests_update (UPDATE)
DROP POLICY IF EXISTS "match_requests_recipient_read" ON match_requests;
CREATE POLICY "match_requests_recipient_read" ON match_requests FOR SELECT TO authenticated
  USING (
    (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    AND NOT is_blocked(from_user_id, to_user_id)
  );

DROP POLICY IF EXISTS "match_requests_insert" ON match_requests;
CREATE POLICY "match_requests_insert" ON match_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND NOT is_blocked(from_user_id, to_user_id)
  );

DROP POLICY IF EXISTS "match_requests_update" ON match_requests;
CREATE POLICY "match_requests_update" ON match_requests FOR UPDATE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (
    (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    AND NOT is_blocked(from_user_id, to_user_id)
  );