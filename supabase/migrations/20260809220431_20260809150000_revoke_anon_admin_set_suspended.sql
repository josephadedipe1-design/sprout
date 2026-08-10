-- Revoke execute on admin_set_suspended from anon (only authenticated admin should call it)
REVOKE EXECUTE ON FUNCTION admin_set_suspended(uuid, boolean) FROM anon;
