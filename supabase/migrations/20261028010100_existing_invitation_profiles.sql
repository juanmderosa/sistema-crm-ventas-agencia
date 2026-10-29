-- Reconcile a confirmed Auth account without changing its password or roles.
create function public.prepare_existing_invitation_profile(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.agency_invitations; existing_user uuid;
begin
 select * into invitation from public.agency_invitations where id=p_invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
 perform 1 from public.platform_admins where user_id=invitation.invited_by and is_active for share;
 if not found then raise exception 'Inviter revoked' using errcode='42501'; end if;
 perform 1 from public.agencies where id=invitation.agency_id and is_active for update;
 if not found then raise exception 'Agency unavailable' using errcode='P0002'; end if;
 select * into invitation from public.agency_invitations where id=p_invitation_id for update;
 if invitation.status<>'sending' or invitation.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='P0001'; end if;
 select id into strict existing_user from auth.users where lower(email)=invitation.email and email_confirmed_at is not null;
 insert into public.profiles(id,display_name) values(existing_user,invitation.display_name) on conflict(id) do nothing;
 return existing_user;
end; $$;
revoke all on function public.prepare_existing_invitation_profile(uuid) from public,anon,authenticated;
grant execute on function public.prepare_existing_invitation_profile(uuid) to service_role;
