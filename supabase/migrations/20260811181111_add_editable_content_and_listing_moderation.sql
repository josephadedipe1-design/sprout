/* Add transparent editing timestamps, listing reports, and admin listing deletion. */

ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS reported_listing_id uuid REFERENCES listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reports_reported_listing_id_idx ON reports(reported_listing_id);

DROP POLICY IF EXISTS "listings_delete_admin" ON listings;
CREATE POLICY "listings_delete_admin" ON listings
  FOR DELETE TO authenticated
  USING (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid);
