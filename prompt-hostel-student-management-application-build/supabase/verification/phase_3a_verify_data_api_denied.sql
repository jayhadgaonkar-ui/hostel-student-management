-- Metadata-only Phase 3A verification. This file never selects application rows.
with required(table_name) as (
  values ('students'), ('payments'), ('archived_students'), ('archived_payments')
), table_security as (
  select
    required.table_name,
    c.oid,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from required
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c
    on c.relnamespace = n.oid
   and c.relname = required.table_name
   and c.relkind in ('r', 'p')
)
select
  table_name,
  oid is not null as required_table_present,
  coalesce(rls_enabled, false) as rls_enabled,
  coalesce(rls_forced, false) as rls_forced,
  case when oid is null then false else not (
    has_table_privilege('anon', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) end as anon_and_authenticated_privileges_absent
from table_security
order by table_name;

-- This must return zero rows. It detects permissive policies exposed to PUBLIC
-- or either browser-facing role on the four application tables.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = any (array[
    'students', 'payments', 'archived_students', 'archived_payments'
  ])
  and permissive = 'PERMISSIVE'
  and roles && array['public', 'anon', 'authenticated']::name[]
order by tablename, policyname;
