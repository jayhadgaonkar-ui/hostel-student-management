-- Metadata-only Phase 3A verification. This file never selects application rows.
-- has_*_privilege checks anon/authenticated effective privileges, including
-- privileges inherited from PUBLIC or another role. PUBLIC is never passed as
-- a login-role argument.
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
  ) end as effective_browser_privileges_absent
from table_security
order by table_name;

-- Every returned owned sequence must report true. Zero rows means the tables
-- have no owned identity/serial sequences.
with application_tables as (
  select c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname = any (array[
      'students', 'payments', 'archived_students', 'archived_payments'
    ])
), owned_sequences as (
  select distinct sequence_class.oid, sequence_ns.nspname, sequence_class.relname
  from application_tables application_table
  join pg_depend dependency on dependency.refobjid = application_table.oid
  join pg_class sequence_class on sequence_class.oid = dependency.objid
  join pg_namespace sequence_ns on sequence_ns.oid = sequence_class.relnamespace
  where dependency.deptype in ('a', 'i')
    and sequence_class.relkind = 'S'
)
select
  nspname as sequence_schema,
  relname as sequence_name,
  not (
    has_sequence_privilege('anon', oid, 'USAGE,SELECT,UPDATE')
    or has_sequence_privilege('authenticated', oid, 'USAGE,SELECT,UPDATE')
  ) as effective_browser_privileges_absent
from owned_sequences
order by sequence_schema, sequence_name;

-- Every returned dependent view/materialized view must report true. Effective
-- checks detect grants inherited through PUBLIC as well as role membership.
with application_tables as (
  select c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname = any (array[
      'students', 'payments', 'archived_students', 'archived_payments'
    ])
), dependent_views as (
  select distinct view_class.oid, view_ns.nspname, view_class.relname
  from application_tables application_table
  join pg_depend dependency on dependency.refobjid = application_table.oid
  join pg_rewrite rewrite_rule on rewrite_rule.oid = dependency.objid
  join pg_class view_class on view_class.oid = rewrite_rule.ev_class
  join pg_namespace view_ns on view_ns.oid = view_class.relnamespace
  where view_class.relkind in ('v', 'm')
)
select
  nspname as view_schema,
  relname as view_name,
  not (
    has_table_privilege('anon', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) as effective_browser_privileges_absent
from dependent_views
order by view_schema, view_name;

-- Every public-schema function must report true. This catches PostgreSQL's
-- default PUBLIC EXECUTE grant because it is effective for both browser roles.
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  not (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) as effective_browser_privileges_absent
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind <> 'p'
order by function_schema, function_name, identity_arguments;

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

-- Default privileges apply per creator role. For the role running this file,
-- all rows must report true; reapply the migration as any other role that will
-- create public-schema application objects and verify again as that role.
with object_types(object_type, default_acl_code, default_acl) as (
  values
    ('tables/views', 'r'::"char", acldefault('r', current_user::regrole)),
    ('sequences', 'S'::"char", acldefault('s', current_user::regrole)),
    ('functions', 'f'::"char", acldefault('f', current_user::regrole))
), effective_defaults as (
  select
    object_types.object_type,
    coalesce(default_acl_entry.defaclacl, object_types.default_acl) as acl
  from object_types
  left join pg_default_acl default_acl_entry
    on default_acl_entry.defaclrole = current_user::regrole
   and default_acl_entry.defaclnamespace = 'public'::regnamespace
   and default_acl_entry.defaclobjtype = object_types.default_acl_code
)
select
  object_type,
  not exists (
    select 1
    from aclexplode(acl) grant_entry
    where grant_entry.grantee in (
      0,
      'anon'::regrole::oid,
      'authenticated'::regrole::oid
    )
  ) as public_anon_authenticated_default_grants_absent
from effective_defaults
order by object_type;
