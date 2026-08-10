-- Ensure only authenticated can execute admin_set_suspended (revoke from anon and public)
REVOKE EXECUTE ON FUNCTION admin_set_suspended(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION admin_set_suspended(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION admin_set_suspended(uuid, boolean) TO authenticated;
