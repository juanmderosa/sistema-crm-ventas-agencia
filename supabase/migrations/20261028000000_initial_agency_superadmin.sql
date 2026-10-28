alter table public.audit_events add column target_user_id uuid references public.profiles(id) on delete restrict;
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
  (action = 'agency.created' and target_user_id is null)
  or (action = 'membership.superadmin_assigned' and target_user_id is not null)
);
create index audit_events_target_user_id_idx on public.audit_events(target_user_id);

create function public.assign_initial_agency_superadmin(p_agency_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  membership_id uuid;
begin
  perform 1 from public.platform_admins where user_id = actor_id and is_active for share;
  if not found then raise exception 'Platform access required' using errcode = '42501'; end if;
  -- Serialize competing initial assignments and agency deactivation.
  perform 1 from public.agencies where id = p_agency_id and is_active for update;
  if not found then raise exception 'Agency unavailable' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = p_user_id for key share;
  if not found then raise exception 'Profile unavailable' using errcode = 'P0002'; end if;
  if exists(select 1 from public.memberships where agency_id = p_agency_id and role = 'agency_superadmin') then
    raise exception 'Initial superadmin already assigned' using errcode = 'P0001';
  end if;
  -- No upsert: existing memberships and their roles are preserved.
  insert into public.memberships(agency_id,user_id,role,is_active)
    values(p_agency_id,p_user_id,'agency_superadmin',true) returning id into membership_id;
  insert into public.audit_events(agency_id,actor_id,action,target_user_id)
    values(p_agency_id,actor_id,'membership.superadmin_assigned',p_user_id);
  return membership_id;
end;
$$;
revoke all on function public.assign_initial_agency_superadmin(uuid,uuid) from public, anon, authenticated;
grant execute on function public.assign_initial_agency_superadmin(uuid,uuid) to authenticated;
