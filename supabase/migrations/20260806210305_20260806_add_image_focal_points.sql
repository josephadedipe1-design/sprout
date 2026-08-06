/*
# Add image focal-point columns to profiles and listing_images

## Summary
Adds two numeric columns to `profiles` and `listing_images` that store the
focal point of an uploaded image as a percentage (0–100) from left and top.
Defaults to 50 (centered). Used by the frontend to set CSS `object-position`
so users can reposition their avatar / listing photos within their display frame.

## Changes

### profiles
- `avatar_position_x` numeric DEFAULT 50 — horizontal focal point (0 = far left, 100 = far right)
- `avatar_position_y` numeric DEFAULT 50 — vertical focal point (0 = top, 100 = bottom)

### listing_images
- `position_x` numeric DEFAULT 50 — horizontal focal point
- `position_y` numeric DEFAULT 50 — vertical focal point

### Security
No RLS policy changes — the existing policies on both tables already cover
SELECT / INSERT / UPDATE / DELETE. The new columns are nullable with safe defaults,
so existing rows and queries continue to work without modification.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS avatar_position_y numeric NOT NULL DEFAULT 50;

ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS position_y numeric NOT NULL DEFAULT 50;
