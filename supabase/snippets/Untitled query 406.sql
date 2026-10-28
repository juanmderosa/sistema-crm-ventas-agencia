begin;
with removed_events as (
  delete from public.audit_events
  where agency_id='e5500000-0000-4000-8000-000000000001'
    and action='membership.superadmin_assigned'
    and actor_id=(select id from auth.users where email='qa-plataforma@example.test')
  returning target_user_id
)
delete from public.memberships
where agency_id='e5500000-0000-4000-8000-000000000001'
  and role='agency_superadmin'
  and user_id in (select target_user_id from removed_events);
delete from public.agencies where id='e5500000-0000-4000-8000-000000000001' and slug='qa-manual-superadmin';
delete from public.platform_admins where user_id=(select id from auth.users where email='qa-plataforma@example.test');
commit;