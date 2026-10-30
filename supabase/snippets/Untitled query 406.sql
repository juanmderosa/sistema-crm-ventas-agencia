begin;
do $$
begin
 if not exists(select 1 from public.agencies where id='f9920000-0000-4000-8000-000000000001' and slug='qa-manual-ajustes')
 or not exists(select 1 from public.agencies where id='f9920000-0000-4000-8000-000000000002' and slug='qa-manual-ajustes-b') then
   raise exception 'No existen las dos agencias QA esperadas';
 end if;
 delete from public.audit_events where agency_id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
 delete from public.agency_settings_history where agency_id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
 delete from public.memberships where agency_id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
 delete from public.agencies where id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
end; $$;
commit;
