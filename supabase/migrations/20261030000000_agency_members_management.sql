alter table public.audit_events add column membership_id uuid;
alter table public.audit_events add constraint audit_events_membership_fk
 foreign key(agency_id,membership_id) references public.memberships(agency_id,id) on delete restrict;
create index audit_events_membership_idx on public.audit_events(membership_id);
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
 (membership_id is not null and target_user_id is not null and invitation_id is null and user_invitation_id is null
   and action in ('membership.activated','membership.deactivated'))
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

-- Narrow roster projection: does not broaden global profiles RLS or expose Auth emails.
create function public.list_agency_members(p_agency_id uuid,p_offset integer default 0)
returns table(id uuid,user_id uuid,display_name text,role text,is_active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_agency_role(p_agency_id) not in ('agency_superadmin','admin')
 or private.current_agency_role(p_agency_id) is null then
   raise exception 'Agency management required' using errcode='42501';
 end if;
 if p_offset is null or p_offset<0 or p_offset>19999980 then raise exception 'Invalid offset' using errcode='22023'; end if;
 return query select m.id,m.user_id,p.display_name,m.role,m.is_active,m.created_at
 from public.memberships m join public.profiles p on p.id=m.user_id
 where m.agency_id=p_agency_id order by m.created_at,m.id limit 21 offset p_offset;
end; $$;
revoke all on function public.list_agency_members(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_agency_members(uuid,integer) to authenticated;

create function public.set_agency_member_active(p_agency_id uuid,p_membership_id uuid,p_is_active boolean,p_expected_is_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor_role text; target public.memberships;
begin
 if p_is_active is null or p_expected_is_active is null or p_is_active=p_expected_is_active then
   raise exception 'Actual state transition required' using errcode='22023';
 end if;
 -- Same prefix lock order as invitation APIs: actor -> agency -> target.
 select role into actor_role from public.memberships
 where agency_id=p_agency_id and user_id=auth.uid() and is_active for share;
 if actor_role is null or actor_role not in ('agency_superadmin','admin') then
   raise exception 'Agency management required' using errcode='42501';
 end if;
 perform 1 from public.agencies where id=p_agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 begin
   -- A target admin may already hold SHARE while waiting for this agency in an
   -- invitation transaction. Never wait on that row and introduce a lock cycle.
   select * into target from public.memberships where id=p_membership_id and agency_id=p_agency_id for update nowait;
 exception when lock_not_available then
   raise exception 'Membership busy; reload and retry' using errcode='40001';
 end;
 if not found then raise exception 'Membership unavailable' using errcode='P0002'; end if;
 if target.user_id=auth.uid() or target.role='agency_superadmin'
 or (actor_role='admin' and target.role<>'seller') then
   raise exception 'Protected membership' using errcode='42501';
 end if;
 if target.is_active<>p_expected_is_active then raise exception 'Membership changed; reload' using errcode='40001'; end if;
 update public.memberships set is_active=p_is_active where id=target.id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,membership_id)
 values(p_agency_id,auth.uid(),case when p_is_active then 'membership.activated' else 'membership.deactivated' end,target.user_id,target.id);
 return target.id;
end; $$;
revoke all on function public.set_agency_member_active(uuid,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.set_agency_member_active(uuid,uuid,boolean,boolean) to authenticated;
