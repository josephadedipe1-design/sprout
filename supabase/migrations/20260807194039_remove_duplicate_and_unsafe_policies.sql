/*
# Remove duplicate/legacy policies creating OR-bypass risks

Found via a systematic audit for tables with multiple policies on the same
command (which Postgres combines with OR, meaning the least restrictive one
wins).

1. posts_own_write (UPDATE) — only checks auth.uid() = author_id, with no
   WITH CHECK at all. This bypasses posts_update's guard preventing a regular
   user from setting is_official = true on their own post — a real security
   gap allowing potential impersonation of official Sprout Team announcements.
   DROPPED.

2. conversations_select (SELECT) — logically identical to conversations_read
   (same conv_status and is_blocked checks). Redundant but not unsafe.
   DROPPED for cleanliness.

3. messages_select (SELECT) — logically identical to messages_read (same
   conv_status and is_blocked checks via conversations join). Redundant but
   not unsafe. DROPPED for cleanliness.
*/

DROP POLICY IF EXISTS "posts_own_write" ON posts;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "messages_select" ON messages;
