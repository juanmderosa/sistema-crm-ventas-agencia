begin;

delete from public.memberships
where (
  agency_id = 'a1100000-0000-4000-8000-000000000001'
  and user_id = (select id from auth.users where email = 'qa-a@example.test')
) or (
  agency_id = 'a1100000-0000-4000-8000-000000000002'
  and user_id in (
    select id from auth.users
    where email in ('qa-a@example.test', 'qa-b@example.test')
  )
);

delete from public.platform_admins
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');

delete from public.agencies
where (id = 'a1100000-0000-4000-8000-000000000001' and slug = 'qa-manual-agencia-a')
   or (id = 'a1100000-0000-4000-8000-000000000002' and slug = 'qa-manual-agencia-b');

commit;
