/*
# Add message_id to reports table

The reports table already has post_id, reply_id, and user_id for reporting posts,
comments, and users respectively, but no column for reporting a private message.
Adds message_id, referencing the messages table.
*/

ALTER TABLE reports ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL;
