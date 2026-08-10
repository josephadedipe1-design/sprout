/*
# Allow viewing other users' children ages

The existing children_own policy (cmd = ALL, auth.uid() = user_id) only allowed
a user to see their OWN children rows, silently hiding this data when viewing
someone else's profile — even though children's ages are meant to be publicly
visible (shown on ProfileView/PublicProfileView, used in Discover/matching).

Splits the single ALL policy into separate INSERT/UPDATE/DELETE (owner-only,
unchanged) and a new SELECT policy allowing any authenticated user to view
children rows, consistent with how profiles themselves are publicly visible.
*/

DROP POLICY IF EXISTS "children_own" ON children;

CREATE POLICY "children_select" ON children FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "children_insert_own" ON children FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "children_update_own" ON children FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "children_delete_own" ON children FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
