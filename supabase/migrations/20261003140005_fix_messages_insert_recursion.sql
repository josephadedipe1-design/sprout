/*
# Fix recursive message-send RLS check

1. Helper Function
- Add `public.has_existing_message(conv_id uuid)`, a SECURITY DEFINER helper that checks whether a conversation already contains a message without evaluating the messages table policy recursively.

2. Security
- Replace the self-referential `messages_insert` policy check with the helper function.
- Keep sender ownership, conversation participation, block protection, accepted-conversation access, and the single introductory-message rule unchanged.
- Grant the helper to authenticated users for use by the RLS policy.

3. Important Notes
- The helper uses a fixed public search path and is read-only.
- No messages or other user data are deleted or changed.
*/

CREATE OR REPLACE FUNCTION public.has_existing_message(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages
    WHERE conversation_id = conv_id
  );
$$;

REVOKE ALL ON FUNCTION public.has_existing_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_existing_message(uuid) TO authenticated;

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
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