-- Add suspended column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- Helper: is a given user suspended? (SECURITY DEFINER to bypass RLS, avoids recursion)
CREATE OR REPLACE FUNCTION public.is_suspended(target_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT COALESCE((SELECT suspended FROM profiles WHERE id = target_uid), false);
$function$;

-- Admin-only function to set the suspended flag on a profile.
-- Regular users cannot update the `suspended` column directly (privilege revoked below),
-- and this function rejects any caller that is not the admin.
CREATE OR REPLACE FUNCTION public.admin_set_suspended(target_uid uuid, val boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid THEN
    UPDATE profiles SET suspended = val WHERE id = target_uid;
  ELSE
    RAISE EXCEPTION 'Not authorized to set suspended flag';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION admin_set_suspended TO authenticated;

-- Prevent any client from updating the `suspended` column directly.
-- Only the admin_set_suspended SECURITY DEFINER function can write it.
REVOKE UPDATE (suspended) ON profiles FROM authenticated;

-- Admin-only DELETE policies on posts and messages (on top of existing owner-only policies)
CREATE POLICY "posts_delete_admin" ON posts FOR DELETE
  TO authenticated USING (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid);

CREATE POLICY "messages_delete_admin" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid);

-- Update SELECT policies to hide content from suspended users (admin still sees everything)
-- Correct real policy names verified against live database: posts_public_read,
-- listings_read, profiles_public_read (not posts_select/listings_select/profiles_select).

-- posts
DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts FOR SELECT
  TO authenticated USING (
    (status = 'active'::text)
    AND (
      (auth.uid() = author_id)
      OR (
        (NOT is_blocked(auth.uid(), author_id))
        AND ((NOT is_suspended(author_id)) OR (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid))
      )
    )
  );

-- listings
DROP POLICY IF EXISTS "listings_read" ON listings;
CREATE POLICY "listings_read" ON listings FOR SELECT
  TO authenticated USING (
    (auth.uid() = seller_id)
    OR (
      (NOT is_blocked(auth.uid(), seller_id))
      AND ((NOT is_suspended(seller_id)) OR (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid))
    )
  );

-- profiles
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT
  TO authenticated USING (
    (auth.uid() = id)
    OR (
      (NOT is_blocked(auth.uid(), id))
      AND ((NOT is_suspended(id)) OR (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'::uuid))
    )
  );