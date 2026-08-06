/*
# Add missing DELETE policy on posts

The posts table has RLS enabled but no DELETE policy at all, meaning every
delete attempt silently affects zero rows (RLS defaults to deny with no
matching policy) rather than erroring — this is why deleted posts, including
Sprout Team announcements, reappear after a page refresh.

Adds a DELETE policy allowing a user to delete their own posts.
*/

CREATE POLICY "posts_delete_own" ON posts FOR DELETE
TO authenticated
USING (auth.uid() = author_id);
