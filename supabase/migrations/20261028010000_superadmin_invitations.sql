create table public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  email text not null check(email=lower(btrim(email)) and char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  display_name text not null check(char_length(btrim(display_name)) between 1 and 160),
  user_id uuid references public.profiles(id) on delete restrict,
  status text not null default 'sending' check(status in ('sending','sent','failed','accepted','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 hour',
  accepted_at timestamptz,
  check((status in ('sent','accepted') and user_id is not null) or status in ('sending','failed','cancelled'))
);
create index agency_invitations_agency_idx on public.agency_invitations(agency_id,created_at desc);
create index agency_invitations_user_idx on public.agency_invitations(user_id);
create index agency_invitations_inviter_idx on public.agency_invitations(invited_by);
alter table public.agency_invitations enable row level security;
revoke all on public.agency_invitations from public,anon,authenticated;
grant select on public.agency_invitations to authenticated;
create policy invitations_read on public.agency_invitations for select to authenticated
using ((select private.is_platform_admin()) or user_id=(select auth.uid()));
alter table public.audit_events add column invitation_id uuid references public.agency_invitations(id) on delete restrict;
create index audit_events_invitation_idx on public.audit_events(invitation_id);
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
 (action='agency.created' and target_user_id is null and invitation_id is null)
 or (action='membership.superadmin_assigned' and target_user_id is not null)
 or (action in ('invitation.sent','invitation.accepted') and target_user_id is not null and invitation_id is not null)
 or (action='invitation.cancelled' and invitation_id is not null)
);

-- Private mutation core; only guarded entry points may call this while holding the agency lock.
create function private.create_initial_superadmin(p_agency uuid,p_user uuid,p_actor uuid,p_invitation uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare membership_id uuid;
begin
 if exists(select 1 from public.memberships where agency_id=p_agency and role='agency_superadmin') then
   raise exception 'Initial superadmin already assigned' using errcode='P0001';
 end if;
 insert into public.memberships(agency_id,user_id,role) values(p_agency,p_user,'agency_superadmin') returning id into membership_id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,invitation_id)
 values(p_agency,p_actor,'membership.superadmin_assigned',p_user,p_invitation);
 return membership_id;
end; $$;
revoke all on function private.create_initial_superadmin(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.assign_initial_agency_superadmin(p_agency_id uuid,p_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.platform_admins where user_id=auth.uid() and is_active for share;
 if not found then raise exception 'Platform access required' using errcode='42501'; end if;
 perform 1 from public.agencies where id=p_agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 if exists(select 1 from public.agency_invitations where agency_id=p_agency_id and status in ('sending','sent') and expires_at>now()) then
   raise exception 'Invitation pending' using errcode='P0001';
 end if;
 perform 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id and u.email_confirmed_at is not null for key share of p;
 if not found then raise exception 'Confirmed profile unavailable' using errcode='P0002'; end if;
 return private.create_initial_superadmin(p_agency_id,p_user_id,auth.uid());
end; $$;

create function public.begin_superadmin_invitation(p_agency_id uuid,p_email text,p_display_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation_id uuid;
begin
 perform 1 from public.platform_admins where user_id=auth.uid() and is_active for share;
 if not found then raise exception 'Platform access required' using errcode='42501'; end if;
 perform 1 from public.agencies where id=p_agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 if exists(select 1 from public.memberships where agency_id=p_agency_id and role='agency_superadmin')
 or exists(select 1 from public.agency_invitations where agency_id=p_agency_id and status in ('sending','sent') and expires_at>now()) then
   raise exception 'Owner or invitation already exists' using errcode='P0001';
 end if;
 if p_email is null or p_display_name is null then raise exception 'Invalid input' using errcode='22023'; end if;
 insert into public.agency_invitations(agency_id,invited_by,email,display_name)
 values(p_agency_id,auth.uid(),lower(btrim(p_email)),btrim(p_display_name)) returning id into invitation_id;
 return invitation_id;
end; $$;
revoke all on function public.begin_superadmin_invitation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_superadmin_invitation(uuid,text,text) to authenticated;

-- This entry point is exclusively for the Edge Function's administrative mail adapter.
create function public.finish_superadmin_invitation(p_invitation_id uuid,p_user_id uuid,p_delivered boolean)
returns void language plpgsql security definer set search_path='' as $$
declare invitation public.agency_invitations;
begin
 select * into invitation from public.agency_invitations where id=p_invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 perform 1 from public.platform_admins where user_id=invitation.invited_by and is_active for share;
 if not found then raise exception 'Inviter revoked' using errcode='42501'; end if;
 perform 1 from public.agencies where id=invitation.agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 select * into invitation from public.agency_invitations where id=p_invitation_id for update;
 if invitation.status<>'sending' or invitation.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='P0001'; end if;
 if p_delivered then
   perform 1 from auth.users where id=p_user_id and lower(email)=invitation.email and invited_at is not null;
   if not found then raise exception 'Invalid invited identity' using errcode='42501'; end if;
   insert into public.profiles(id,display_name) values(p_user_id,invitation.display_name) on conflict(id) do nothing;
   update public.agency_invitations set status='sent',user_id=p_user_id where id=p_invitation_id;
   insert into public.audit_events(agency_id,actor_id,action,target_user_id,invitation_id)
   values(invitation.agency_id,invitation.invited_by,'invitation.sent',p_user_id,p_invitation_id);
 else
   update public.agency_invitations set status='failed' where id=p_invitation_id;
 end if;
end; $$;
revoke all on function public.finish_superadmin_invitation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_superadmin_invitation(uuid,uuid,boolean) to service_role;

create function public.cancel_superadmin_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare invitation public.agency_invitations;
begin
 perform 1 from public.platform_admins where user_id=auth.uid() and is_active for share;
 if not found then raise exception 'Platform access required' using errcode='42501'; end if;
 select * into invitation from public.agency_invitations where id=p_invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 perform 1 from public.agencies where id=invitation.agency_id for update;
 select * into invitation from public.agency_invitations where id=p_invitation_id for update;
 if invitation.status not in ('sending','sent') then raise exception 'Invitation cannot be cancelled' using errcode='P0001'; end if;
 update public.agency_invitations set status='cancelled' where id=p_invitation_id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,invitation_id)
 values(invitation.agency_id,auth.uid(),'invitation.cancelled',invitation.user_id,p_invitation_id);
end; $$;
revoke all on function public.cancel_superadmin_invitation(uuid) from public,anon,authenticated;
grant execute on function public.cancel_superadmin_invitation(uuid) to authenticated;

create function public.accept_superadmin_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.agency_invitations; membership_id uuid;
begin
 select * into invitation from public.agency_invitations where id=p_invitation_id;
 if not found or invitation.user_id is distinct from auth.uid() then raise exception 'Invitation identity required' using errcode='42501'; end if;
 perform 1 from public.platform_admins where user_id=invitation.invited_by and is_active for share;
 if not found then raise exception 'Inviter revoked' using errcode='42501'; end if;
 perform 1 from public.agencies where id=invitation.agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 select * into invitation from public.agency_invitations where id=p_invitation_id for update;
 if invitation.status<>'sent' or invitation.expires_at<=now() then raise exception 'Invitation expired or used' using errcode='P0001'; end if;
 perform 1 from auth.users where id=auth.uid() and lower(email)=invitation.email and email_confirmed_at is not null and coalesce(encrypted_password,'')<>'';
 if not found then raise exception 'Verified identity with password required' using errcode='42501'; end if;
 membership_id:=private.create_initial_superadmin(invitation.agency_id,auth.uid(),invitation.invited_by,p_invitation_id);
 update public.agency_invitations set status='accepted',accepted_at=now() where id=p_invitation_id;
 insert into public.audit_events(agency_id,actor_id,action,target_user_id,invitation_id)
 values(invitation.agency_id,auth.uid(),'invitation.accepted',auth.uid(),p_invitation_id);
 return membership_id;
end; $$;
revoke all on function public.accept_superadmin_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_superadmin_invitation(uuid) to authenticated;
