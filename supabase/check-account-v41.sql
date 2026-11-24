-- Read-only diagnostics: no account IDs, emails, tokens or member data are returned.
with expected(name,kind,oid) as (
 values
 ('account subscriptions','table',to_regclass('public.nagachi_account_subscriptions')::oid),
 ('admin allowlist','table',to_regclass('public.nagachi_companion_admins')::oid),
 ('admin check','function',to_regprocedure('public.nagachi_account_is_admin()')::oid),
 ('subscribe','function',to_regprocedure('public.nagachi_account_subscribe(text[])')::oid),
 ('news','function',to_regprocedure('public.nagachi_account_news()')::oid),
 ('account recipient totals','function',to_regprocedure('public.nagachi_admin_account_subscribers()')::oid),
 ('legacy subscribe revoked','legacy',to_regprocedure('public.nagachi_subscribe_updates(text,text,text[])')::oid)
)
select name,case
 when oid is null then 'MISSING'
 when kind='table' then case when exists(select 1 from pg_class c where c.oid=expected.oid and c.relrowsecurity)
   and not has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE')
   and not has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') then 'OK' else 'CHECK RLS / GRANTS' end
 when kind='legacy' then case when not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE') then 'OK' else 'CHECK GRANTS' end
 else case when exists(select 1 from pg_proc p where p.oid=expected.oid and p.prosecdef)
   and has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') then 'OK' else 'CHECK FUNCTION / GRANTS' end
 end as status from expected order by name;
