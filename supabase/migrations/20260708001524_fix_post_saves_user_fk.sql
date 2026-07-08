ALTER TABLE post_saves
  ADD CONSTRAINT post_saves_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
