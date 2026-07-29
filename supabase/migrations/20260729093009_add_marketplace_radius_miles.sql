/*
# Add marketplace_radius_miles to profiles

1. Changes
- Adds `marketplace_radius_miles` (integer, default 10) to the `profiles` table.
- This column stores each user's preferred search radius (in miles) for the
  Marketplace view, independent of the fixed 10-mile Discovery/Feed radius.
2. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ block.
- No RLS changes needed — existing profiles policies already cover the new column.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'marketplace_radius_miles'
  ) THEN
    ALTER TABLE profiles ADD COLUMN marketplace_radius_miles integer NOT NULL DEFAULT 10;
  END IF;
END $$;
