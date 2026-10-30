alter table public.agencies add column settings_version uuid not null default gen_random_uuid();
create table public.agency_settings_history (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.agencies(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 previous_name text not null,
 new_name text not null check(char_length(btrim(new_name)) between 1 and 160),
 previous_ars_per_usd numeric(18,6) not null check(previous_ars_per_usd>0 and previous_ars_per_usd<>'NaN'::numeric),
 new_ars_per_usd numeric(18,6) not null check(new_ars_per_usd>0 and new_ars_per_usd<>'NaN'::numeric),
 created_at timestamptz not null default now(),
 unique(agency_id,id),
 check(previous_name<>new_name or previous_ars_per_usd<>new_ars_per_usd)
);
create index agency_settings_history_agency_idx on public.agency_settings_history(agency_id,created_at desc,id desc);
create index agency_settings_history_actor_idx on public.agency_settings_history(actor_id);
alter table public.agency_settings_history enable row level security;
revoke all on public.agency_settings_history from public,anon,authenticated;
grant select on public.agency_settings_history to authenticated;
create policy agency_settings_history_read on public.agency_settings_history for select to authenticated
using (private.current_agency_role(agency_id) in ('agency_superadmin','admin'));
alter table public.audit_events add column settings_change_id uuid;
alter table public.audit_events add constraint audit_events_settings_change_fk
 foreign key(agency_id,settings_change_id) references public.agency_settings_history(agency_id,id) on delete restrict;
create index audit_events_settings_change_idx on public.audit_events(settings_change_id);
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
 (action='agency.settings_updated' and settings_change_id is not null and target_user_id is null
   and membership_id is null and invitation_id is null and user_invitation_id is null)
 or (settings_change_id is null and (
  (membership_id is not null and target_user_id is not null and invitation_id is null and user_invitation_id is null
   and action in ('membership.activated','membership.deactivated','membership.role_changed'))
  or (membership_id is null and (
   (user_invitation_id is null and (
    (action='agency.created' and target_user_id is null and invitation_id is null)
    or (action='membership.superadmin_assigned' and target_user_id is not null)
    or (action in ('invitation.sent','invitation.accepted') and target_user_id is not null and invitation_id is not null)
    or (action='invitation.cancelled' and invitation_id is not null)))
   or (user_invitation_id is not null and invitation_id is null and (
    (action in ('user_invitation.sent','user_invitation.accepted','membership.user_invited') and target_user_id is not null)
    or action='user_invitation.cancelled'))
  ))
 ))
);

create function public.update_agency_settings(p_agency_id uuid,p_expected_version uuid,p_name text,p_ars_per_usd text)
returns uuid language plpgsql security definer set search_path='' as $$
declare agency public.agencies; change_id uuid; rate numeric(18,6);
begin
 perform 1 from public.memberships where agency_id=p_agency_id and user_id=auth.uid()
   and is_active and role in ('agency_superadmin','admin') for share;
 if not found then raise exception 'Agency management required' using errcode='42501'; end if;
 select * into agency from public.agencies where id=p_agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 160 or p_expected_version is null
 or p_ars_per_usd is null or p_ars_per_usd !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' then
   raise exception 'Invalid settings input' using errcode='22023';
 end if;
 rate:=p_ars_per_usd::numeric;
 if rate<=0 then raise exception 'Invalid rate' using errcode='22023'; end if;
 if agency.settings_version<>p_expected_version then raise exception 'Settings changed; reload' using errcode='40001'; end if;
 if agency.name=btrim(p_name) and agency.ars_per_usd=rate then raise exception 'No settings changed' using errcode='22023'; end if;
 insert into public.agency_settings_history(agency_id,actor_id,previous_name,new_name,previous_ars_per_usd,new_ars_per_usd)
 values(agency.id,auth.uid(),agency.name,btrim(p_name),agency.ars_per_usd,rate) returning id into change_id;
 update public.agencies set name=btrim(p_name),ars_per_usd=rate,settings_version=change_id where id=agency.id;
 insert into public.audit_events(agency_id,actor_id,action,settings_change_id)
 values(agency.id,auth.uid(),'agency.settings_updated',change_id);
 return change_id;
end; $$;
revoke all on function public.update_agency_settings(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_agency_settings(uuid,uuid,text,text) to authenticated;
