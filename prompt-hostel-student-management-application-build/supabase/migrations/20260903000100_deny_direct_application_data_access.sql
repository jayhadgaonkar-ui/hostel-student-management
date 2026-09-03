-- Phase 3A: browser clients may use Supabase Auth, but application data is
-- accessible only through the service-role backend. Safe to run repeatedly.
begin;

do $migration$
declare
  required_table text;
  relation record;
  owned_sequence record;
  dependent_view record;
  public_function record;
begin
  -- Fail before making changes if the expected schema is incomplete.
  foreach required_table in array array[
    'students', 'payments', 'archived_students', 'archived_payments'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_table
        and c.relkind in ('r', 'p')
    ) then
      raise exception 'Required application table public.% is missing', required_table;
    end if;
  end loop;

  for relation in
    select c.oid, n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname = any (array[
        'students', 'payments', 'archived_students', 'archived_payments'
      ])
  loop
    execute format('alter table %I.%I enable row level security', relation.nspname, relation.relname);
    execute format('alter table %I.%I force row level security', relation.nspname, relation.relname);
    execute format('revoke all privileges on table %I.%I from public, anon, authenticated', relation.nspname, relation.relname);

    -- Protect identity/serial sequences owned by application-table columns.
    for owned_sequence in
      select sequence_ns.nspname, sequence_class.relname
      from pg_depend dependency
      join pg_class sequence_class on sequence_class.oid = dependency.objid
      join pg_namespace sequence_ns on sequence_ns.oid = sequence_class.relnamespace
      where dependency.refobjid = relation.oid
        and dependency.deptype in ('a', 'i')
        and sequence_class.relkind = 'S'
    loop
      execute format('revoke all privileges on sequence %I.%I from public, anon, authenticated', owned_sequence.nspname, owned_sequence.relname);
    end loop;

    -- Revoke access to views that directly depend on an application table.
    for dependent_view in
      select distinct view_ns.nspname, view_class.relname
      from pg_depend dependency
      join pg_rewrite rewrite_rule on rewrite_rule.oid = dependency.objid
      join pg_class view_class on view_class.oid = rewrite_rule.ev_class
      join pg_namespace view_ns on view_ns.oid = view_class.relnamespace
      where dependency.refobjid = relation.oid
        and view_class.relkind in ('v', 'm')
    loop
      execute format('revoke all privileges on table %I.%I from public, anon, authenticated', dependent_view.nspname, dependent_view.relname);
    end loop;
  end loop;

  -- The application currently invokes no database functions. Deny browser
  -- execution of any user-defined public-schema function so a function cannot
  -- become an alternate path around the protected tables.
  for public_function in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind <> 'p'
  loop
    execute format(
      'revoke all privileges on function %I.%I(%s) from public, anon, authenticated',
      public_function.nspname,
      public_function.proname,
      public_function.arguments
    );
  end loop;
end
$migration$;

-- Secure objects subsequently created by the role applying this migration.
-- PostgreSQL treats views as tables for default-privilege purposes.
alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke all privileges on functions from public, anon, authenticated;

commit;
