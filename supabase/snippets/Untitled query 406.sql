begin;
do $$
begin
 if not exists(select 1 from public.agencies where id='f8800000-0000-4000-8000-000000000001' and slug='qa-manual-usuarios')
 or not exists(select 1 from public.agencies where id='f8800000-0000-4000-8000-000000000002' and slug='qa-manual-usuarios-b') then
   raise exception 'No existe la agencia QA esperada';
 end if;
 delete from public.audit_events where agency_id in ('f8800000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002');
 delete from public.agency_user_invitations where agency_id in ('f8800000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002');
 delete from public.memberships where agency_id in ('f8800000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002');
 delete from public.agencies where id in ('f8800000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002');
end; $$;
commit;
