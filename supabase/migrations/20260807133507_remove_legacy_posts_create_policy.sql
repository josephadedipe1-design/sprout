/*
# Remove legacy posts_create INSERT policy

posts had two permissive INSERT policies active simultaneously: posts_insert
(the real, current policy — ownership check, official-post guard, 30-second
rate limit) and posts_create (a legacy policy only checking auth.uid() IS NOT
NULL, with no ownership check and no rate limit at all).

Since Postgres OR's together multiple permissive policies on the same table,
posts_create has been silently bypassing every check in posts_insert this
whole time — including today's rate limit, and potentially allowing a user
to insert a post with a mismatched author_id.

Drops posts_create entirely, leaving only posts_insert as the sole INSERT
policy on posts.
*/

DROP POLICY IF EXISTS "posts_create" ON posts;
