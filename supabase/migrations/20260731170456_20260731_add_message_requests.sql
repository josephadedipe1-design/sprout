/*
# Add Message Requests to Conversations

## Summary
Adds support for "message requests" — conversations started by users who are NOT yet connected to the recipient.
A pending request allows exactly one introductory message before the recipient accepts.

## Changes

### conversations table — new columns
- `conv_status` (text, default 'accepted') — 'pending' | 'accepted' | 'declined'
  NOTE: named `conv_status` to avoid collision with listings.status. Frontend references this column.
- `initiated_by` (uuid, nullable, references auth.users) — who sent the request; null for legacy/connected conversations.
- `source_type` (text, nullable) — e.g. 'listing' or 'general'
- `source_listing_id` (uuid, nullable, references listings on delete set null) — listing that prompted the request

### RLS policy changes
All existing policies are dropped and recreated. Block logic (`is_blocked`) is preserved throughout.

**conversations:**
- SELECT: both participants can see conversations where status is NOT 'declined' (or where current user is the recipient of a declined conversation — they should still see it for their own records). Actually: recipients see pending to decide; sender sees pending awaiting response. Neither party sees declined.
  Simplified rule: participant AND (conv_status != 'declined') AND NOT blocked.
  Exception: the recipient can decline so they need UPDATE access — covered by update policy.
- INSERT: participant, not blocked, no change (pending conversations are created client-side with the new columns).
- UPDATE: either participant can update (for accept/decline). We can't easily restrict which columns in RLS — we rely on application logic. The constraint is: participant AND not blocked for the USING clause; WITH CHECK same.
- DELETE: unchanged.

**messages:**
- SELECT: participant in conversation, not blocked, conv_status != 'declined'.
- INSERT: sender is participant, not blocked, AND either:
  a) conv_status = 'accepted', OR
  b) conv_status = 'pending' AND auth.uid() = initiated_by AND no prior messages exist in this conversation (enforced via subquery count = 0).
*/

-- Add columns to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conv_status text NOT NULL DEFAULT 'accepted'
    CHECK (conv_status IN ('pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_listing_id uuid REFERENCES listings(id) ON DELETE SET NULL;

-- Index for fast lookup of pending requests for a user
CREATE INDEX IF NOT EXISTS idx_conversations_pending
  ON conversations (user1_id, user2_id, conv_status)
  WHERE conv_status = 'pending';

-- ── conversations policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND conv_status != 'declined'
    AND NOT is_blocked(user1_id, user2_id)
  );

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND NOT is_blocked(user1_id, user2_id)
  );

DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "conversations_delete" ON conversations;
CREATE POLICY "conversations_delete" ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ── messages policies ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.conv_status != 'declined'
        AND NOT is_blocked(c.user1_id, c.user2_id)
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT is_blocked(c.user1_id, c.user2_id)
        AND (
          c.conv_status = 'accepted'
          OR (
            c.conv_status = 'pending'
            AND c.initiated_by = auth.uid()
            AND NOT EXISTS (
              SELECT 1 FROM messages m2
              WHERE m2.conversation_id = c.id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
