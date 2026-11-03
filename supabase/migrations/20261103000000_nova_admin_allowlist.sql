create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.nova_admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint nova_admin_allowlist_email_lowercase check (email = lower(email))
);
alter table private.nova_admin_allowlist enable row level security;
revoke all on table private.nova_admin_allowlist from public, anon, authenticated;
grant select on table private.nova_admin_allowlist to service_role;

insert into private.nova_admin_allowlist (email)
values ('julingben22@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_nova_admin(candidate_email text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from private.nova_admin_allowlist
    where email = lower(trim(candidate_email))
  );
$$;
revoke all on function public.is_nova_admin(text) from public, anon, authenticated;
grant execute on function public.is_nova_admin(text) to service_role;
