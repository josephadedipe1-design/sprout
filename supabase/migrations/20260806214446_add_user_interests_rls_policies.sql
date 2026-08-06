/*
# Add missing RLS policies on user_interests

The user_interests table has RLS enabled but no policies at all, meaning every
insert/select/delete has been silently failing (RLS defaults to deny with no
matching policy) — this is why interests selected at signup were never
actually saved, and never displayed on the profile.

Adds:
- SELECT: users can see their own interests, and other users' interests too
  (matches the general pattern of profiles being publicly viewable, since
  interests are shown on public profiles for matching purposes).
- INSERT: users can insert their own interest rows.
- DELETE: users can remove their own interest rows.
*/

CREATE POLICY "user_interests_select" ON user_interests FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "user_interests_insert" ON user_interests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_interests_delete" ON user_interests FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
