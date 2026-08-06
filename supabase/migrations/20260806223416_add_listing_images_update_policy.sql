/*
# Add missing UPDATE policy on listing_images

listing_images has RLS enabled with only INSERT and SELECT policies — no
UPDATE policy exists, meaning any update (e.g. saving the new position_x/
position_y focal-point values) silently affects zero rows rather than
erroring. Adds an UPDATE policy allowing the owning seller (via listings.seller_id)
to update their own listing's images.
*/

CREATE POLICY "listing_images_update" ON listing_images FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = listing_images.listing_id
      AND l.seller_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = listing_images.listing_id
      AND l.seller_id = auth.uid()
  )
);
