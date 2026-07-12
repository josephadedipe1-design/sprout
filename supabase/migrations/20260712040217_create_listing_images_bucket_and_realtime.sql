-- Create listing-images public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "listing_images_bucket_select" ON storage.objects;
CREATE POLICY "listing_images_bucket_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "listing_images_bucket_insert" ON storage.objects;
CREATE POLICY "listing_images_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "listing_images_bucket_update" ON storage.objects;
CREATE POLICY "listing_images_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "listing_images_bucket_delete" ON storage.objects;
CREATE POLICY "listing_images_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'listing-images');

-- Enable realtime on match_requests so clients can subscribe to changes
ALTER PUBLICATION supabase_realtime ADD TABLE match_requests;
