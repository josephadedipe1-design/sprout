
-- Rename user_id -> seller_id
ALTER TABLE listings RENAME COLUMN user_id TO seller_id;

-- Rename price -> price_pence and convert from pounds to pence
ALTER TABLE listings RENAME COLUMN price TO price_pence;
UPDATE listings SET price_pence = price_pence * 100;

-- Add status column, populate from sold boolean, then drop sold
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
UPDATE listings SET status = 'sold' WHERE sold = true;
ALTER TABLE listings DROP COLUMN IF EXISTS sold;

-- Drop image_url (images now live in listing_images)
ALTER TABLE listings DROP COLUMN IF EXISTS image_url;

-- Add new columns
ALTER TABLE listings ADD COLUMN IF NOT EXISTS offers_welcome boolean NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS postcode_district text NOT NULL DEFAULT '';

-- Update RLS policies to use new column name
DROP POLICY IF EXISTS "listings_insert" ON listings;
DROP POLICY IF EXISTS "listings_update" ON listings;
DROP POLICY IF EXISTS "listings_delete" ON listings;
DROP POLICY IF EXISTS "listings_select" ON listings;

CREATE POLICY "listings_select" ON listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "listings_insert" ON listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "listings_update" ON listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "listings_delete" ON listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);

-- Create listing_images table if it doesn't already exist
CREATE TABLE IF NOT EXISTS listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_images_select" ON listing_images;
DROP POLICY IF EXISTS "listing_images_insert" ON listing_images;
DROP POLICY IF EXISTS "listing_images_delete" ON listing_images;

CREATE POLICY "listing_images_select" ON listing_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "listing_images_insert" ON listing_images FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = (SELECT seller_id FROM listings WHERE id = listing_id));
CREATE POLICY "listing_images_delete" ON listing_images FOR DELETE TO authenticated
  USING (auth.uid() = (SELECT seller_id FROM listings WHERE id = listing_id));

-- Index for fast image lookups
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id, position);
