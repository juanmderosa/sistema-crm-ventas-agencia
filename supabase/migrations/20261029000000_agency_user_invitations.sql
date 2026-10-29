-- Agency-managed invitations are separate from the platform's initial-owner slot.
-- No existing owner RPC or email endpoint accepts these invitation identifiers.
create table public.agency_user_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  email text not null check(email=lower(btrim(email)) and char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  display_name text not null check(char_length(btrim(display_name)) between 1 and 160),
  role text not null check(role in ('admin','seller')),
  user_id uuid references public.profiles(id) on delete restrict,
  status text not null default 'sending' check(status in ('sending','sent','failed','accepted','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 hour',
  accepted_at timestamptz,
  unique(agency_id,id),
  check(status not in ('sent','accepted') or user_id is not null),
  check((status='accepted')=(accepted_at is not null))
);
create index agency_user_invitations_agency_idx on public.agency_user_invitations(agency_id,created_at desc);
create index agency_user_invitations_inviter_idx on public.agency_user_invitations(invited_by);
create index agency_user_invitations_user_idx on public.agency_user_invitations(user_id);
alter table public.agency_user_invitations enable row level security;
revoke all on public.agency_user_invitations from public,anon,authenticated;
grant select on public.agency_user_invitations to authenticated;
create policy agency_user_invitations_read on public.agency_user_invitations for select to authenticated
using (
 user_id=(select auth.uid())
 or private.current_agency_role(agency_id)='agency_superadmin'
 or (role='seller' and private.current_agency_role(agency_id)='admin')
);

alter table public.audit_events add column user_invitation_id uuid;
alter table public.audit_events add constraint audit_events_user_invitation_fk
 foreign key(agency_id,user_invitation_id) references public.agency_user_invitations(agency_id,id) on delete restrict;
create index audit_events_user_invitation_idx on public.audit_events(user_invitation_id);
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
 (user_invitation_id is null and (
   (action='agency.created' and target_user_id is null and invitation_id is null)
   or (action='membership.superadmin_assigned' and target_user_id is not null)
   or (action in ('invitation.sent','invitation.accepted') and target_user_id is not null and invitation_id is not null)
   or (action='invitation.cancelled' and invitation_id is not null)
 ))
 or (user_invitation_id is not null and invitation_id is null and (
   (action in ('user_invitation.sent','user_invitation.accepted','membership.user_invited') and target_user_id is not null)
   or action='user_invitation.cancelled'
 ))
);

-- Shared authoritative check. Locks are always inviter membership -> agency -> invitation.
-- SHARE prevents concurrent revocation/demotion until the calling transaction commits.
create function private.lock_agency_user_inviter(p_agency uuid,p_actor uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare actor_role text;
begin
 if p_role is null or p_role not in ('admin','seller') then
   raise exception 'Invalid invitation role' using errcode='22023';
 end if;
 select role into actor_role from public.memberships
 where agency_id=p_agency and user_id=p_actor and is_active for share;
 if actor_role is null or not (actor_role='agency_superadmin' or (actor_role='admin' and p_role='seller')) then
   raise exception 'Agency management required' using errcode='42501';
 end if;
 perform 1 from public.agencies where id=p_agency and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
end; $$;
revoke all on function private.lock_agency_user_inviter(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.begin_agency_user_invitation(p_agency_id uuid,p_email text,p_display_name text,p_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation_id uuid; normalized_email text:=lower(btrim(p_email));
begin
 perform private.lock_agency_user_inviter(p_agency_id,auth.uid(),p_role);
 if normalized_email is null or char_length(normalized_email) not between 3 and 254
 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 160 then
   raise exception 'Invalid invitation input' using errcode='22023';
 end if;
 if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id
   where m.agency_id=p_agency_id and lower(u.email)=normalized_email)
 or exists(select 1 from public.agency_user_invitations where agency_id=p_agency_id
   and email=normalized_email and status in ('sending','sent') and expires_at>now()) then
   raise exception 'Membership or invitation already exists' using errcode='P0001';
 end if;
 insert into public.agency_user_invitations(agency_id,invited_by,email,display_name,role)
 values(p_agency_id,auth.uid(),normalized_email,btrim(p_display_name),p_role) returning id into invitation_id;
 return invitation_id;
end; $$;
revoke all on function public.begin_agency_user_invitation(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_agency_user_invitation(uuid,text,text,text) to authenticated;

-- Only the future trusted mail adapter may bind its Auth response. No Auth passwords change here.
create function public.finish_agency_user_invitation(p_invitation_id uuid,p_user_id uuid,p_delivered boolean)
returns void language plpgsql security definer set search_path='' as $$
declare invitation public.agency_user_invitations;
begin
 select * into invitation from public.agency_user_invitations where id=p_invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 perform private.lock_agency_user_inviter(invitation.agency_id,invitation.invited_by,invitation.role);
 select * into invitation from public.agency_user_invitations where id=p_invitation_id for update;
 if invitation.status<>'sending' or invitation.expires_at<=now() then
   raise exception 'Invitation unavailable' using errcode='P0001';
 end if;
 if p_delivered is null then raise exception 'Delivery result required' using errcode='22023'; end if;
 if p_delivered then
   perform 1 from auth.users where id=p_user_id and lower(email)=invitation.email
     and (invited_at is not null or email_confirmed_at is not null);
   if not found then raise exception 'Invalid invited identity' using errcode='42501'; end if;
   if exists(select 1 from public.memberships where agency_id=invitation.agency_id and user_id=p_user_id) then
     raise exception 'Membership already exists' using errcode='P0001';
   end if;
   insert into public.profiles(id,display_name) values(p_user_id,invitation.display_name) on conflict(id) do nothing;
   update public.agency_user_invitations set status='sent',user_id=p_user_id where id=p_invitation_id;
   insert into public.audit_events(agency_id,actor_id,action,target_user_id,user_invitation_id)
   values(invitation.agency_id,invitation.invited_by,'user_invitation.sent',p_user_id,p_invitation_id);
 else
   update public.agency_user_invitations set status='failed' where id=p_invitation_id;
 end if;
end; $$;
revoke all on function public.finish_agency_user_invitation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_agency_user_invitation(uuid,uuid,boolean) to service_role;

create function public.cancel_agency_user_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare invitation public.agency_user_invitations;
begin
 select * into invitation from public.agency_user_invitations where id=p_invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 perform private.lock_agency_user_inviter(invitation.agency_id,auth.uid(),invitation.role);
 select * into invitation from public.agency_user_invitations where id=p_invitation_id for update;
 if invitation.status not in ('sending','sent') then raise exception 'Invitation cannot be cancelled' using errcode='P0001'; end if;
 update public.agency_user_invitations set status='cancelled' where id=p_invitation_id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,user_invitation_id)
 values(invitation.agency_id,auth.uid(),'user_invitation.cancelled',invitation.user_id,p_invitation_id);
end; $$;
revoke all on function public.cancel_agency_user_invitation(uuid) from public,anon,authenticated;
grant execute on function public.cancel_agency_user_invitation(uuid) to authenticated;

create function public.accept_agency_user_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.agency_user_invitations; membership_id uuid;
begin
 select * into invitation from public.agency_user_invitations where id=p_invitation_id;
 if not found or invitation.user_id is distinct from auth.uid() then
   raise exception 'Invitation identity required' using errcode='42501';
 end if;
 perform private.lock_agency_user_inviter(invitation.agency_id,invitation.invited_by,invitation.role);
 select * into invitation from public.agency_user_invitations where id=p_invitation_id for update;
 if invitation.status<>'sent' or invitation.expires_at<=now() then
   raise exception 'Invitation expired or used' using errcode='P0001';
 end if;
 perform 1 from auth.users where id=auth.uid() and lower(email)=invitation.email
   and email_confirmed_at is not null and coalesce(encrypted_password,'')<>'';
 if not found then raise exception 'Verified identity with password required' using errcode='42501'; end if;
 if exists(select 1 from public.memberships where agency_id=invitation.agency_id and user_id=auth.uid()) then
   raise exception 'Membership already exists' using errcode='P0001';
 end if;
 insert into public.memberships(agency_id,user_id,role) values(invitation.agency_id,auth.uid(),invitation.role) returning id into membership_id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,user_invitation_id)
 values(invitation.agency_id,invitation.invited_by,'membership.user_invited',auth.uid(),p_invitation_id);
 update public.agency_user_invitations set status='accepted',accepted_at=now() where id=p_invitation_id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,user_invitation_id)
 values(invitation.agency_id,auth.uid(),'user_invitation.accepted',auth.uid(),p_invitation_id);
 return membership_id;
end; $$;
revoke all on function public.accept_agency_user_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_agency_user_invitation(uuid) to authenticated;
