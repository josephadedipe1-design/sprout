/*
# Add get_blocked_users function

The profiles SELECT policy correctly hides blocked users' profiles from general
app use (mutual invisibility). However, a user's own "Blocked users" list in
Settings needs to show the name/avatar of people THEY blocked, which the normal
policy now prevents. This SECURITY DEFINER function bypasses that specific
restriction, safely, since a user viewing their own block list already knows
who they blocked.
*/

CREATE OR REPLACE FUNCTION get_blocked_users()
RETURNS TABLE (
  block_id uuid,
  user_id uuid,
  first_name text,
  last_initial text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id as block_id,
    b.blocked_id as user_id,
    p.first_name,
    p.last_initial,
    p.avatar_url,
    b.created_at
  FROM blocks b
  JOIN profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_blocked_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_blocked_users() TO authenticated;
