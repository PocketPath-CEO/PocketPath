-- rls_auto_enable() is a SECURITY DEFINER event trigger that auto-enables RLS
-- on newly created tables. It fires automatically on DDL events and must not
-- be callable by anon or authenticated roles via /rest/v1/rpc/rls_auto_enable.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;