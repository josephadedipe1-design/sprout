/*
# Fix infinite recursion in messages_insert policy

The messages_insert policy's WITH CHECK clause contained a subquery directly
against messages (checking for an existing message in a pending conversation),
which caused Postgres to detect infinite recursion when evaluating RLS on
messages — breaking EVERY message insert, not just the pending-conversation
case it was meant to restrict.

Fixed the same way is_blocked/is_suspended already solve this elsewhere in
this schema: a SECURITY DEFINER helper function bypasses RLS for the inner
check, breaking the recursive cycle.
*/

CREATE OR REPLACE FUNCTION public.has_existing_message(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM messages WHERE conversation_id = conv_id);
$$;

REVOKE ALL ON FUNCTION has_existing_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_existing_message(uuid) TO authenticated;

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
            AND NOT has_existing_message(c.id)
          )
        )
    )
  );
