begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users(id) values
('c2200000-0000-4000-8000-000000000001'),
('c2200000-0000-4000-8000-000000000002');
insert into public.profiles(id, display_name) values
('c2200000-0000-4000-8000-000000000001', 'Plataforma QA'),
('c2200000-0000-4000-8000-000000000002', 'Usuario QA');
insert into public.platform_admins(user_id) values ('c2200000-0000-4000-8000-000000000001');

set local role anon;
select throws_ok($$ select public.create_agency('QA', 'qa-creation-anon', '1000') $$, '42501', null, 'Anonymous cannot execute creation');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$ select public.create_agency('QA', 'qa-creation-no-user', '1000') $$, '42501', null, 'Missing identity cannot create');
select set_config('request.jwt.claims', '{"sub":"c2200000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"platform_admin"}}', true);
select throws_ok($$ select public.create_agency('QA', 'qa-creation-forged', '1000') $$, '42501', null, 'Forged metadata cannot grant creation');
select throws_ok($$ insert into public.agencies(name, slug, ars_per_usd) values ('QA', 'qa-creation-direct', 1000) $$, '42501', null, 'Direct agency writes remain forbidden');
select throws_ok($$ insert into public.audit_events(agency_id, actor_id, action) values (gen_random_uuid(), auth.uid(), 'agency.created') $$, '42501', null, 'Clients cannot forge audit events');
select is((select count(*) from public.audit_events), 0::bigint, 'Ordinary users see no platform audit');

select set_config('request.jwt.claims', '{"sub":"c2200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.create_agency(' Agencia QA ', 'qa-creation-atomic', '999999999999.999999') $$, 'Active platform admin creates agency');
select is((select name from public.agencies where slug = 'qa-creation-atomic'), 'Agencia QA', 'Name is trimmed');
select is((select ars_per_usd::text from public.agencies where slug = 'qa-creation-atomic'), '999999999999.999999', 'Numeric precision is preserved');
select ok((select is_active from public.agencies where slug = 'qa-creation-atomic'), 'New agency is active');
select is((select count(*) from public.audit_events where actor_id = auth.uid()), 1::bigint, 'Exactly one creation event is recorded');
select is((select action from public.audit_events where agency_id = (select id from public.agencies where slug = 'qa-creation-atomic')), 'agency.created', 'Event references the created agency');
select throws_ok($$ select public.create_agency('Otra', 'qa-creation-atomic', '1') $$, '23505', null, 'Duplicate slug rejected');
select is((select count(*) from public.audit_events where actor_id = auth.uid()), 1::bigint, 'Failed duplicate creates no audit event');
select throws_ok($$ select public.create_agency(' ', 'qa-creation-invalid', '1') $$, '22023', null, 'Blank name rejected');
select throws_ok($$ select public.create_agency('QA', '../invalid', '1') $$, '22023', null, 'Malformed slug rejected');
select throws_ok($$ select public.create_agency('QA', 'qa-creation-zero', '0') $$, '22023', null, 'Zero rate rejected');
select throws_ok($$ select public.create_agency('QA', 'qa-creation-precision', '1.1234567') $$, '22023', null, 'Excess precision rejected rather than rounded');
select throws_ok($$ select public.create_agency('QA', 'qa-creation-nan', 'NaN') $$, '22023', null, 'Nonfinite rate rejected');
select throws_ok($$ update public.audit_events set action = 'agency.created' where actor_id = auth.uid() $$, '42501', null, 'Even platform cannot rewrite audit directly');
select throws_ok($$ delete from public.audit_events where actor_id = auth.uid() $$, '42501', null, 'Even platform cannot delete audit directly');

reset role;
insert into public.memberships(agency_id, user_id, role)
select id, 'c2200000-0000-4000-8000-000000000002', 'seller'
from public.agencies where slug = 'qa-creation-atomic';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2200000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.create_agency('QA', 'qa-creation-seller', '1') $$, '42501', null, 'Agency seller cannot create agencies');
reset role;
update public.memberships set role = 'admin' where user_id = 'c2200000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$ select public.create_agency('QA', 'qa-creation-admin', '1') $$, '42501', null, 'Agency admin cannot create agencies');
reset role;
update public.memberships set role = 'agency_superadmin' where user_id = 'c2200000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$ select public.create_agency('QA', 'qa-creation-owner', '1') $$, '42501', null, 'Agency superadmin cannot create agencies');
select is((select count(*) from public.audit_events), 0::bigint, 'Agency management cannot read platform audit');

reset role;
create function pg_temp.reject_creation_audit() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.agencies where id = new.agency_id and slug = 'qa-creation-rollback') then
    raise exception 'Synthetic audit failure' using errcode = '22000';
  end if;
  return new;
end;
$$;
create trigger reject_creation_audit before insert on public.audit_events
for each row execute function pg_temp.reject_creation_audit();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.create_agency('QA', 'qa-creation-rollback', '1') $$, '22000', null, 'Audit failure rejects the entire operation');
select is((select count(*) from public.agencies where slug = 'qa-creation-rollback'), 0::bigint, 'Failed audit leaves no agency');
select is((select count(*) from public.audit_events where actor_id = auth.uid()), 1::bigint, 'Failed audit leaves no partial event');

reset role;
update public.platform_admins set is_active = false where user_id = 'c2200000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$ select public.create_agency('QA', 'qa-creation-revoked', '1') $$, '42501', null, 'Revoked assignment cannot create');
select is((select count(*) from public.audit_events), 0::bigint, 'Revocation also removes audit visibility');
select * from finish();
rollback;
