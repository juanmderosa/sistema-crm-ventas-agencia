begin;
create extension if not exists pgtap with schema extensions;
select plan(105);

-- Synthetic identities only. All fixtures and test helpers roll back.
insert into auth.users (id)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 14) n;
insert into public.profiles (id, display_name)
select id, 'Usuario de prueba' from auth.users
where id between '00000000-0000-0000-0000-000000000001' and '00000000-0000-0000-0000-000000000014';
insert into public.agencies (id, slug, name, ars_per_usd) values
('10000000-0000-0000-0000-000000000001', 'test-agency-a', 'Agencia A', 1000),
('10000000-0000-0000-0000-000000000002', 'test-agency-b', 'Agencia B', 1200);
insert into public.memberships (agency_id, user_id, role, is_active)
select ('10000000-0000-0000-0000-' || lpad(a::text, 12, '0'))::uuid,
  ('00000000-0000-0000-0000-' || lpad(((a - 1) * 5 + n)::text, 12, '0'))::uuid,
  case n when 1 then 'agency_superadmin' when 2 then 'admin' else 'seller' end,
  n <> 5
from generate_series(1, 2) a cross join generate_series(1, 5) n;
-- User 11 has different roles in the two agencies.
insert into public.memberships (agency_id, user_id, role) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'admin'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'seller');
insert into public.platform_admins (user_id, is_active) values
('00000000-0000-0000-0000-000000000012', true),
('00000000-0000-0000-0000-000000000013', false);

-- Real database roles and JWT subject; no privileged test helper executes reads.
create function pg_temp.identify(n integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', '00000000-0000-0000-0000-' || lpad(n::text, 12, '0'),
    'role', 'authenticated',
    'user_metadata', json_build_object('role', 'platform_admin', 'agency_id', '10000000-0000-0000-0000-000000000002')
  )::text, true);
end;
$$;

set local role authenticated;
select pg_temp.identify(1);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 1 sees one agency');
select pg_temp.identify(2);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 2 sees one agency');
select pg_temp.identify(3);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 3 sees one agency');
select pg_temp.identify(4);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 4 sees one agency');
select pg_temp.identify(6);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 6 sees one agency');
select pg_temp.identify(7);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 7 sees one agency');
select pg_temp.identify(8);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 8 sees one agency');
select pg_temp.identify(9);
select is((select count(*) from public.agencies), 1::bigint, 'Active user 9 sees one agency');
-- Separate statements ensure the subject is set before each protected query.
select pg_temp.identify(1);
select is((select count(*) from public.memberships), 6::bigint, 'A superadmin sees A memberships');
select is((select count(*) from public.memberships where agency_id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'A superadmin cannot read B');
select pg_temp.identify(2);
select is((select count(*) from public.memberships), 6::bigint, 'A admin sees A memberships');
select pg_temp.identify(3);
select is((select count(*) from public.memberships), 1::bigint, 'A seller sees own membership');
select is((select count(*) from public.profiles), 1::bigint, 'Seller sees only own profile');
select is((select count(*) from public.platform_admins), 0::bigint, 'Seller cannot see platform assignments');
select is((select count(*) from public.agencies where id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'Forged agency filter does not grant access');
select is(private.current_agency_role('10000000-0000-0000-0000-000000000002'), null::text, 'Helper cannot disclose another agency role');
select is(private.current_agency_role('10000000-0000-0000-0000-000000000001'), 'seller', 'Helper uses database role despite forged metadata');
select pg_temp.identify(4);
select is((select count(*) from public.memberships), 1::bigint, 'Second A seller sees only own membership');
select pg_temp.identify(6);
select is((select count(*) from public.memberships), 6::bigint, 'B superadmin sees B memberships');
select pg_temp.identify(7);
select is((select count(*) from public.memberships), 6::bigint, 'B admin sees B memberships');
select is((select count(*) from public.memberships where agency_id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'B admin cannot read A');
select is((select count(*) from public.profiles), 1::bigint, 'Admin cannot read team private profiles');
select pg_temp.identify(8);
select is((select count(*) from public.memberships), 1::bigint, 'B seller sees own membership');
select pg_temp.identify(9);
select is((select count(*) from public.memberships), 1::bigint, 'Second B seller sees own membership');
select pg_temp.identify(5);
select is((select count(*) from public.agencies), 0::bigint, 'Inactive A membership grants no agency access');
select is((select count(*) from public.memberships), 0::bigint, 'Inactive A membership grants no roster access');
select pg_temp.identify(10);
select is((select count(*) from public.agencies), 0::bigint, 'Inactive B membership grants no agency access');
select is((select count(*) from public.memberships), 0::bigint, 'Inactive B membership grants no roster access');
select pg_temp.identify(11);
select is((select count(*) from public.agencies), 2::bigint, 'Multi-agency member sees both agencies');
select is((select count(*) from public.memberships), 7::bigint, 'Admin in A and seller in B retain separate permissions');
select pg_temp.identify(12);
-- Scope global-admin counts to fixture IDs so manual local data can coexist.
select is((select count(*) from public.agencies where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')), 2::bigint, 'Platform admin sees both agencies without membership');
select is((select count(*) from public.memberships where agency_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')), 12::bigint, 'Platform admin sees all fixture memberships');
select is((select count(*) from public.profiles where id between '00000000-0000-0000-0000-000000000001' and '00000000-0000-0000-0000-000000000014'), 14::bigint, 'Platform admin sees fixture profiles');
select is((select count(*) from public.platform_admins where user_id in ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000013')), 2::bigint, 'Platform admin sees fixture assignments');
select pg_temp.identify(13);
select is((select count(*) from public.agencies), 0::bigint, 'Inactive platform admin has no global access');
select pg_temp.identify(14);
select is((select count(*) from public.agencies), 0::bigint, 'No membership grants no agency access despite forged metadata');
select is((select count(*) from public.memberships), 0::bigint, 'No membership grants no roster access');
select is((select count(*) from public.profiles), 1::bigint, 'User without membership can read own profile');

-- Neither client role has table writes, including platform administrators.
select ok(not has_table_privilege(r, 'public.' || t, p), r || ' has no ' || p || ' on ' || t)
from (values ('anon'), ('authenticated')) roles(r)
cross join (values ('agencies'), ('profiles'), ('memberships'), ('platform_admins')) tables(t)
cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) privileges(p);
select pg_temp.identify(3);
select throws_ok($$update public.memberships set role = 'agency_superadmin'$$, '42501', null, 'Seller cannot elevate role');
select throws_ok($$insert into public.memberships (agency_id, user_id, role) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'admin')$$, '42501', null, 'Cannot self-assign to another agency');
select throws_ok($$insert into public.platform_admins (user_id) values (auth.uid())$$, '42501', null, 'Cannot self-assign platform access');
select throws_ok($$update public.profiles set id = '00000000-0000-0000-0000-000000000012'$$, '42501', null, 'Cannot impersonate through profile');
select pg_temp.identify(1);
select throws_ok($$update public.memberships set role = 'admin'$$, '42501', null, 'Agency superadmin has no direct role writes');
select pg_temp.identify(12);
select throws_ok($$update public.platform_admins set is_active = true$$, '42501', null, 'Platform admin also has no direct writes');

reset role;
update public.agencies set is_active = false where slug = 'test-agency-a';
set local role authenticated;
select pg_temp.identify(1);
select is((select count(*) from public.agencies), 0::bigint, 'Inactive agency revokes even superadmin access');
select is((select count(*) from public.memberships), 0::bigint, 'Inactive agency hides roster');
select pg_temp.identify(11);
select is((select count(*) from public.agencies), 1::bigint, 'Other active agency remains available');
select is((select count(*) from public.memberships), 1::bigint, 'Other agency role remains seller');
select pg_temp.identify(12);
select is((select count(*) from public.agencies where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')), 2::bigint, 'Platform can inspect inactive agency');
reset role;
update public.memberships set is_active = false where user_id = '00000000-0000-0000-0000-000000000007';
set local role authenticated;
select pg_temp.identify(7);
select is((select count(*) from public.memberships), 0::bigint, 'Membership revocation applies without refreshing JWT');
reset role;
update public.platform_admins set is_active = false where user_id = '00000000-0000-0000-0000-000000000012';
set local role authenticated;
select pg_temp.identify(12);
select is((select count(*) from public.agencies), 0::bigint, 'Platform revocation applies without refreshing JWT');
select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from public.profiles), 0::bigint, 'Missing subject grants no profile access');
reset role;

set local role anon;
select throws_ok('select * from public.' || t, '42501', null, 'Anonymous cannot read ' || t)
from (values ('agencies'), ('profiles'), ('memberships'), ('platform_admins')) tables(t);
select throws_ok($$select private.current_agency_role('10000000-0000-0000-0000-000000000001')$$, '42501', null, 'Anonymous cannot execute authorization helper');
reset role;

-- Integrity rules are checked as the provisioning role, independently of grants.
select throws_ok($$insert into public.agencies (slug, name, ars_per_usd) values ('test-agency-a', 'Duplicate', 1)$$, '23505', null, 'Unique slug');
select throws_ok($$insert into public.agencies (slug, name, ars_per_usd) values ('Bad Slug', 'Invalid', 1)$$, '23514', null, 'Canonical slug');
select throws_ok($$insert into public.agencies (slug, name, ars_per_usd) values ('zero', 'Invalid', 0)$$, '23514', null, 'Positive exchange rate');
select throws_ok($$insert into public.agencies (slug, name, ars_per_usd) values ('nan', 'Invalid', 'NaN')$$, '23514', null, 'Finite exchange rate');
select throws_ok($$insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-000000000099', 'Orphan')$$, '23503', null, 'Profile requires auth identity');
select throws_ok($$insert into public.memberships (agency_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'seller')$$, '23505', null, 'Unique agency/user');
select throws_ok($$update public.memberships set role = 'platform_admin'$$, '23514', null, 'Platform is not an agency role');
select throws_ok($$update public.memberships set agency_id = '10000000-0000-0000-0000-000000000099' where user_id = '00000000-0000-0000-0000-000000000001'$$, '23503', null, 'Membership requires agency');
select throws_ok($$update public.memberships set user_id = '00000000-0000-0000-0000-000000000099' where user_id = '00000000-0000-0000-0000-000000000001'$$, '23503', null, 'Membership requires profile');
select throws_ok($$insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000099')$$, '23503', null, 'Platform assignment requires profile');
select throws_ok($$insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000012')$$, '23505', null, 'Platform assignment is unique');
select throws_ok($$delete from public.profiles where id = '00000000-0000-0000-0000-000000000001'$$, '23503', null, 'Deletion cannot silently remove memberships');
select ok(c.relrowsecurity, 'RLS enabled on ' || c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('agencies', 'profiles', 'memberships', 'platform_admins');
select * from finish();
rollback;
