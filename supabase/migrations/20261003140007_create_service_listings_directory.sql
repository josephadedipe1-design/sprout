/*
# Create Directory (service_listings) table

## Purpose
Adds a new "Directory" feature where the admin can list local businesses and
services aimed at expectant parents and parents of young children. Regular users
browse listings within 10 miles; only the admin can create, edit, or deactivate
listings. This is a separate table from marketplace `listings`.

## New Tables
- `service_listings`
  - `id` (uuid PK, defaults to gen_random_uuid())
  - `business_name` (text, not null) — display name of the business/service
  - `category` (text, not null) — constrained to:
    pregnancy_birth, health_wellbeing, childcare, classes_activities,
    home_family, education_development
  - `description` (text, not null, defaults to '') — short description
  - `phone` (text, nullable) — contact phone
  - `email` (text, nullable) — contact email
  - `website` (text, nullable) — website URL
  - `postcode_district` (text, not null, defaults to '') — outcode only, e.g. "ME5"
  - `lat` (double precision, nullable) — latitude for distance filtering
  - `lng` (double precision, nullable) — longitude for distance filtering
  - `image_url` (text, nullable) — optional listing image
  - `verified` (boolean, not null, defaults false) — shows "Verified" badge
  - `featured` (boolean, not null, defaults false) — admin can feature listings
  - `status` (text, not null, defaults 'active') — constrained to active/inactive
  - `created_at` (timestamptz, defaults now())
  - `created_by` (uuid, nullable) — the admin user who created the listing

## Security (RLS)
- RLS enabled on `service_listings`.
- SELECT: `TO authenticated` where `status = 'active'` — all signed-in users
  can browse active listings. Distance filtering (10 miles) is applied in the
  application layer, same pattern as posts/marketplace, NOT in RLS.
- INSERT: `TO authenticated` restricted to the admin UUID only
  (same pattern as `posts_insert` official-post guard).
- UPDATE: `TO authenticated` restricted to the admin UUID only
  (same pattern as admin-only `listings_delete_admin`).
- DELETE: `TO authenticated` restricted to the admin UUID only.

## Storage
- Creates a new public storage bucket `service-listing-images` for directory
  listing images, with SELECT (public) and INSERT/UPDATE/DELETE (authenticated)
  policies matching the existing `listing-images` bucket pattern.

## Important notes
1. The admin UUID is `4848415f-2bbe-409a-8443-eb925b0b88e8`, matching the
   existing ADMIN_ID used in posts/listings policies.
2. Distance filtering is done in the frontend using haversine + the user's own
   lat/lng, identical to FeedView and MarketView — RLS only gates visibility by
   status, not by distance.
3. The migration is idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS service_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  category text NOT NULL CHECK (
    category IN ('pregnancy_birth', 'health_wellbeing', 'childcare', 'classes_activities', 'home_family', 'education_development')
  ),
  description text NOT NULL DEFAULT '',
  phone text,
  email text,
  website text,
  postcode_district text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  image_url text,
  verified boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE service_listings ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can see active listings
DROP POLICY IF EXISTS "service_listings_select" ON service_listings;
CREATE POLICY "service_listings_select"
  ON service_listings FOR SELECT
  TO authenticated
  USING (status = 'active');

-- INSERT: admin only
DROP POLICY IF EXISTS "service_listings_insert" ON service_listings;
CREATE POLICY "service_listings_insert"
  ON service_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid);

-- UPDATE: admin only
DROP POLICY IF EXISTS "service_listings_update" ON service_listings;
CREATE POLICY "service_listings_update"
  ON service_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid)
  WITH CHECK (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid);

-- DELETE: admin only
DROP POLICY IF EXISTS "service_listings_delete" ON service_listings;
CREATE POLICY "service_listings_delete"
  ON service_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_service_listings_status ON service_listings(status);

-- Storage bucket for directory listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-listing-images', 'service-listing-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "service_listing_images_bucket_select" ON storage.objects;
CREATE POLICY "service_listing_images_bucket_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'service-listing-images');

DROP POLICY IF EXISTS "service_listing_images_bucket_insert" ON storage.objects;
CREATE POLICY "service_listing_images_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-listing-images');

DROP POLICY IF EXISTS "service_listing_images_bucket_update" ON storage.objects;
CREATE POLICY "service_listing_images_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'service-listing-images');

DROP POLICY IF EXISTS "service_listing_images_bucket_delete" ON storage.objects;
CREATE POLICY "service_listing_images_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'service-listing-images');