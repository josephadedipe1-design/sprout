/*
# Add user_settings table and post_likes timestamp

1. New Tables
   - `user_settings` — Persists per-user notification prefs, privacy prefs, and theme
     - `user_id` (uuid PK, FK to auth.users, cascade delete)
     - `notification_prefs` (jsonb) — keys: conn, likes, comments, messages, events
     - `privacy_prefs` (jsonb) — keys: neighborhood, activity, requests
     - `theme` (text) — 'light', 'system', or 'dark'
     - `created_at`, `updated_at` timestamps

2. Modified Tables
   - `post_likes` — adds `created_at` column so notifications can be time-sorted

3. Security
   - RLS enabled on user_settings, owner-scoped (user can only see/edit their own row)
*/

-- ─── USER SETTINGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_prefs jsonb NOT NULL DEFAULT '{"conn":true,"likes":true,"comments":true,"messages":true,"events":false}',
  privacy_prefs jsonb NOT NULL DEFAULT '{"neighborhood":true,"activity":true,"requests":true}',
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON user_settings;
CREATE POLICY "settings_select" ON user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_insert" ON user_settings;
CREATE POLICY "settings_insert" ON user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_update" ON user_settings;
CREATE POLICY "settings_update" ON user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_delete" ON user_settings;
CREATE POLICY "settings_delete" ON user_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── POST LIKES TIMESTAMP ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_likes' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE post_likes ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ─── STORAGE BUCKET FOR LISTING IMAGES ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "listing_images_select" ON storage.objects;
CREATE POLICY "listing_images_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "listing_images_insert" ON storage.objects;
CREATE POLICY "listing_images_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "listing_images_delete" ON storage.objects;
CREATE POLICY "listing_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'listing-images');
