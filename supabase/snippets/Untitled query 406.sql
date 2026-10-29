begin;
delete from public.audit_events where agency_id='f7700000-0000-4000-8000-000000000001';
delete from public.memberships
where agency_id='f7700000-0000-4000-8000-000000000001'
  and user_id in (select user_id from public.agency_invitations where agency_id='f7700000-0000-4000-8000-000000000001');
delete from public.agency_invitations where agency_id='f7700000-0000-4000-8000-000000000001';
delete from public.agencies where id='f7700000-0000-4000-8000-000000000001' and slug='qa-manual-invitaciones';
delete from public.platform_admins where user_id=(select id from auth.users where email='qa-plataforma@example.test');
commit;
