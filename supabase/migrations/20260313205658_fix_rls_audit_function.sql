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
        p.polname::text as policyname,
        CASE p.polcmd 
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
            ELSE p.polcmd::text
        END as cmd,
        p.polroles::text[] as roles,
        pg_get_expr(p.polqual, p.polrelid) as using_expr,
        pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = t.oid
    WHERE n.nspname = 'public' 
      AND t.relkind = 'r'
    ORDER BY t.relname, p.polname;
END;
$$;
;
