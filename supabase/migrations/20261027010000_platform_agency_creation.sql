-- Narrow audited creation API. Direct writes remain unavailable to application users.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action = 'agency.created'),
  created_at timestamptz not null default now()
);
create index audit_events_agency_id_idx on public.audit_events(agency_id);
create index audit_events_actor_id_idx on public.audit_events(actor_id);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;
create policy audit_events_platform_read on public.audit_events for select to authenticated
using ((select private.is_platform_admin()));

create function public.create_agency(p_name text, p_slug text, p_ars_per_usd text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  agency_id uuid;
  actor_id uuid := auth.uid();
begin
  -- Lock the live assignment until commit: a concurrent revocation cannot race this check.
  perform 1 from public.platform_admins p
    where p.user_id = actor_id and p.is_active for share;
  if not found then
    raise exception 'Platform access required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160
    or p_slug is null or char_length(p_slug) not between 1 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_ars_per_usd is null
    or p_ars_per_usd !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' then
    raise exception 'Invalid agency input' using errcode = '22023';
  end if;
  if p_ars_per_usd::numeric <= 0 then
    raise exception 'Invalid agency rate' using errcode = '22023';
  end if;
  insert into public.agencies(name, slug, ars_per_usd)
    values (btrim(p_name), p_slug, p_ars_per_usd::numeric)
    returning id into agency_id;
  insert into public.audit_events(agency_id, actor_id, action)
    values (agency_id, actor_id, 'agency.created');
  return agency_id;
end;
$$;
revoke all on function public.create_agency(text, text, text) from public, anon, authenticated;
grant execute on function public.create_agency(text, text, text) to authenticated;
