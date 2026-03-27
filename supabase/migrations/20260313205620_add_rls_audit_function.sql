CREATE OR REPLACE FUNCTION get_rls_summary()
RETURNS TABLE (
    tablename text,
    rls_enabled boolean,
    policyname text,
    cmd text,
    roles text[],
    using_expr text,
    check_expr text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::text as tablename,
        t.relrowsecurity as rls_enabled,
        p.policyname::text,
        p.cmd::text,
        p.roles::text[],
        p.qual::text as using_expr,
        p.with_check::text as check_expr
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_policy p ON p.reloid = t.oid
    WHERE n.nspname = 'public' 
      AND t.relkind = 'r'
    ORDER BY t.relname, p.policyname;
END;
$$;

-- Grant access to authenticated users or just keep it for service role? 
-- The user said "npm run generate-audit", which usually runs on a dev machine with service key or admin access.
GRANT EXECUTE ON FUNCTION get_rls_summary() TO service_role;
GRANT EXECUTE ON FUNCTION get_rls_summary() TO authenticated; -- To allow the script to run with a user session if needed
;
