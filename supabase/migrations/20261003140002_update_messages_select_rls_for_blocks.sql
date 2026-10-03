/*
# Update messages_select RLS to enforce block filtering

The messages SELECT policy previously only checked conversation participation.
Now it also verifies no block relationship exists between the two conversation
participants, so messages from blocked conversations are invisible even if
someone knows the conversation_id.
*/

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT is_blocked(c.user1_id, c.user2_id)
    )
  );
