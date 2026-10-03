/*
# Add image_url to posts + announcement-images storage bucket

1. New Columns
- `posts.image_url` (text, nullable) — stores the public URL of an uploaded
  announcement image. Only used by official Sprout Team announcement posts.

2. New Storage Bucket
- `announcement-images` — public read access so feed images load without
  auth headers. Upload restricted to the admin user via RLS policies.

3. Storage Policies
- SELECT (public read): anyone can read objects.
- INSERT/UPDATE/DELETE: only the admin user (4848415f-...) can manage them.

4. Important Notes
- All statements are idempotent.
*/

ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "announcement_images_select" ON storage.objects;
CREATE POLICY "announcement_images_select" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'announcement-images');

DROP POLICY IF EXISTS "announcement_images_insert" ON storage.objects;
CREATE POLICY "announcement_images_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'announcement-images' AND auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8');

DROP POLICY IF EXISTS "announcement_images_update" ON storage.objects;
CREATE POLICY "announcement_images_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'announcement-images' AND auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8');

DROP POLICY IF EXISTS "announcement_images_delete" ON storage.objects;
CREATE POLICY "announcement_images_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'announcement-images' AND auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8');
