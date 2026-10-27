-- Read-only authorization foundation. Provisioning APIs and audited writes are deferred.
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  is_active boolean not null default true,
  ars_per_usd numeric(18, 6) not null check (ars_per_usd > 0 and ars_per_usd <> 'NaN'::numeric),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('agency_superadmin', 'admin', 'seller')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agency_id, user_id),
  unique (agency_id, id)
);
create index memberships_user_id_idx on public.memberships(user_id);

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;

-- Remove Supabase default grants: browser clients have SELECT only.
revoke all on public.agencies, public.profiles, public.memberships, public.platform_admins from public, anon, authenticated;
grant select on public.agencies, public.profiles, public.memberships, public.platform_admins to authenticated;

-- Helpers are outside exposed API schemas. They read authoritative database roles,
-- never user metadata, and bypass RLS only to avoid policy recursion.
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid()) and is_active
  );
$$;

create function private.current_agency_role(target_agency_id uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.memberships m
  join public.agencies a on a.id = m.agency_id
  where m.agency_id = target_agency_id and m.user_id = (select auth.uid())
    and m.is_active and a.is_active;
$$;

revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.current_agency_role(uuid) from public, anon, authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.current_agency_role(uuid) to authenticated;

create policy agencies_read on public.agencies for select to authenticated using (
  (select private.is_platform_admin()) or private.current_agency_role(id) is not null
);
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select private.is_platform_admin())
);
create policy memberships_read on public.memberships for select to authenticated using (
  (select private.is_platform_admin())
  or private.current_agency_role(agency_id) in ('agency_superadmin', 'admin')
  or (user_id = (select auth.uid()) and private.current_agency_role(agency_id) is not null)
);
create policy platform_admins_read on public.platform_admins for select to authenticated using (
  (select private.is_platform_admin())
);
