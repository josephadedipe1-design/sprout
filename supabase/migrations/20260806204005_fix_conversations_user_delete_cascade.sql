/*
# Fix conversations foreign keys to cascade on user deletion

conversations.user1_id and user2_id currently have delete_rule = NO ACTION,
meaning a user cannot be deleted while they have any conversation, blocking
account deletion entirely (self-service and admin). Change both to
ON DELETE CASCADE, consistent with the delete behavior used everywhere else
in this schema (e.g. messages.sender_id).
*/

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user1_id_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_user1_id_fkey
  FOREIGN KEY (user1_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_user2_id_fkey
  FOREIGN KEY (user2_id) REFERENCES profiles(id) ON DELETE CASCADE;
