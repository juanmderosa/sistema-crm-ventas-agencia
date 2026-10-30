-- Resolve only the email of a live authorized reservation, never arbitrary Auth users.
create function public.prepare_existing_agency_user_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.agency_user_invitations; target_id uuid;
begin
 select * into invitation from public.agency_user_invitations where id=p_invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 perform private.lock_agency_user_inviter(invitation.agency_id,invitation.invited_by,invitation.role);
 select * into invitation from public.agency_user_invitations where id=p_invitation_id for update;
 if invitation.status<>'sending' or invitation.expires_at<=now() then
   raise exception 'Invitation unavailable' using errcode='P0001';
 end if;
 select id into target_id from auth.users where lower(email)=invitation.email
   and email_confirmed_at is not null;
 if target_id is null then raise exception 'Confirmed identity unavailable' using errcode='P0002'; end if;
 return target_id;
end; $$;
revoke all on function public.prepare_existing_agency_user_invitation(uuid) from public,anon,authenticated;
grant execute on function public.prepare_existing_agency_user_invitation(uuid) to service_role;
