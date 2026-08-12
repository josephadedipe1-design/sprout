/*
# Track listing sale dates for time-limited browsing visibility

1. New Columns
- `public.listings.sold_at` (timestamptz, nullable): records when a listing is marked sold. It remains null for active listings and preserves the original row after sale.

2. Modified Tables
- `public.listings`: adds the nullable sale timestamp and an index to support browsing queries that include recently sold listings.

3. Security
- No row-level security policies are changed. The live listings policies continue to control who can read, update, and delete listing rows.

4. Important Notes
- Normal browsing will show active listings plus sold listings whose `sold_at` is within the previous 30 days.
- Listings older than that remain stored and directly accessible by ID; this migration does not delete or hide rows at the database policy level.
- The application records `sold_at` at the same time it changes `status` to `sold`.
*/

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sold_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_status_sold_at
  ON public.listings (status, sold_at DESC);
