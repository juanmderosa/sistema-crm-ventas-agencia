alter table public.agencies add column status_version uuid not null default gen_random_uuid();
alter table public.audit_events add column previous_is_active boolean;
alter table public.audit_events add column new_is_active boolean;
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
 (action in ('agency.activated','agency.deactivated') and settings_change_id is null
  and membership_id is null and target_user_id is null and invitation_id is null and user_invitation_id is null)
 or (
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
 )))
);
alter table public.audit_events add constraint audit_events_agency_status_check check (
 (action='agency.activated' and previous_is_active is false and new_is_active is true)
 or (action='agency.deactivated' and previous_is_active is true and new_is_active is false)
 or (action not in ('agency.activated','agency.deactivated') and previous_is_active is null and new_is_active is null)
);

create function public.set_agency_active(p_agency_id uuid,p_is_active boolean,p_expected_version uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare agency public.agencies; next_version uuid:=gen_random_uuid();
begin
 perform 1 from public.platform_admins where user_id=auth.uid() and is_active for share;
 if not found then raise exception 'Platform access required' using errcode='42501'; end if;
 if p_is_active is null or p_expected_version is null then raise exception 'State and version required' using errcode='22023'; end if;
 select * into agency from public.agencies where id=p_agency_id for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 if agency.status_version<>p_expected_version then raise exception 'Agency state changed; reload' using errcode='40001'; end if;
 if agency.is_active=p_is_active then raise exception 'Actual transition required' using errcode='22023'; end if;
 update public.agencies set is_active=p_is_active,status_version=next_version where id=agency.id;
 insert into public.audit_events(agency_id,actor_id,action,previous_is_active,new_is_active)
 values(agency.id,auth.uid(),case when p_is_active then 'agency.activated' else 'agency.deactivated' end,agency.is_active,p_is_active);
 return next_version;
end; $$;
revoke all on function public.set_agency_active(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_agency_active(uuid,boolean,uuid) to authenticated;
