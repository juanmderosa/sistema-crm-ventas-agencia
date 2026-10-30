alter table public.audit_events add column previous_role text;
alter table public.audit_events add column new_role text;
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
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
);
alter table public.audit_events add constraint audit_events_role_transition_check check (
 (action='membership.role_changed' and previous_role is not null and new_role is not null
  and previous_role in ('admin','seller') and new_role in ('admin','seller') and previous_role<>new_role)
 or (action<>'membership.role_changed' and previous_role is null and new_role is null)
);

create function public.set_agency_member_role(p_agency_id uuid,p_membership_id uuid,p_role text,p_expected_role text,p_expected_is_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare target public.memberships;
begin
 if p_role is null or p_expected_role is null or p_expected_is_active is null
 or p_role not in ('admin','seller') or p_expected_role not in ('admin','seller') or p_role=p_expected_role then
   raise exception 'Actual admin/seller transition required' using errcode='22023';
 end if;
 -- Preserve the actor -> agency -> target lock order shared by membership/invitation APIs.
 perform 1 from public.memberships where agency_id=p_agency_id and user_id=auth.uid()
   and role='agency_superadmin' and is_active for share;
 if not found then raise exception 'Agency owner required' using errcode='42501'; end if;
 perform 1 from public.agencies where id=p_agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 begin
   select * into target from public.memberships where agency_id=p_agency_id and id=p_membership_id for update nowait;
 exception when lock_not_available then
   raise exception 'Membership busy; reload and retry' using errcode='40001';
 end;
 if not found then raise exception 'Membership unavailable' using errcode='P0002'; end if;
 if target.user_id=auth.uid() or target.role not in ('admin','seller') then
   raise exception 'Protected membership' using errcode='42501';
 end if;
 if target.role<>p_expected_role or target.is_active<>p_expected_is_active then
   raise exception 'Membership changed; reload' using errcode='40001';
 end if;
 update public.memberships set role=p_role where id=target.id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,membership_id,previous_role,new_role)
 values(p_agency_id,auth.uid(),'membership.role_changed',target.user_id,target.id,target.role,p_role);
 return target.id;
end; $$;
revoke all on function public.set_agency_member_role(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.set_agency_member_role(uuid,uuid,text,text,boolean) to authenticated;
