/*
# Add post_saves table

Allows users to bookmark/save posts for later reference.

1. New Tables
   - `post_saves` — join table linking a user to a saved post
     - `post_id` (uuid, FK → posts.id, cascade delete)
     - `user_id` (uuid, not null, defaults to auth.uid())
     - `created_at` (timestamptz)
     - Primary key is (post_id, user_id) — one save per user per post

2. Security
   - RLS enabled; authenticated users can only manage their own saves
   - SELECT, INSERT, DELETE policies (no UPDATE needed for a join table)
*/

CREATE TABLE IF NOT EXISTS post_saves (
  post_id   uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_post_saves" ON post_saves;
CREATE POLICY "select_own_post_saves" ON post_saves FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_post_saves" ON post_saves;
CREATE POLICY "insert_own_post_saves" ON post_saves FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_post_saves" ON post_saves;
CREATE POLICY "delete_own_post_saves" ON post_saves FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
