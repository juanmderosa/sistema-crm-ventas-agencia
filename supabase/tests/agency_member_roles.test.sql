begin;
create extension if not exists pgtap with schema extensions;
select plan(27);
insert into auth.users(id,email,email_confirmed_at,encrypted_password)
select ('e7100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'roles-'||n||'@example.test',now(),'synthetic' from generate_series(1,5) n;
insert into public.profiles(id,display_name) select id,'QA roles' from auth.users where id::text like 'e7100000-%';
insert into public.agencies(id,name,slug,ars_per_usd) values
 ('e7200000-0000-4000-8000-000000000001','QA roles A','qa-member-roles-a',1000),
 ('e7200000-0000-4000-8000-000000000002','QA roles B','qa-member-roles-b',1000);
insert into public.memberships(id,agency_id,user_id,role) values
 ('e7300000-0000-4000-8000-000000000001','e7200000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000001','agency_superadmin'),
 ('e7300000-0000-4000-8000-000000000002','e7200000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000002','admin'),
 ('e7300000-0000-4000-8000-000000000003','e7200000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000003','seller'),
 ('e7300000-0000-4000-8000-000000000004','e7200000-0000-4000-8000-000000000002','e7100000-0000-4000-8000-000000000003','seller'),
 ('e7300000-0000-4000-8000-000000000005','e7200000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000004','agency_superadmin');
insert into public.platform_admins(user_id) values ('e7100000-0000-4000-8000-000000000005');
set local role anon;
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',true)$$,'42501',null,'Anonymous cannot change roles');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',true)$$,'42501',null,'Platform alone cannot change roles');
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"agency_superadmin"}}',true);
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',true)$$,'42501',null,'Seller cannot promote itself through metadata');
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',true)$$,'42501',null,'Admin cannot promote sellers');
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000001','seller','admin',true)$$,'42501',null,'Own membership protected');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000005','seller','admin',true)$$,'42501',null,'Other owner protected');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000004','admin','seller',true)$$,'P0002',null,'Foreign target membership denied');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','agency_superadmin','seller',true)$$,'22023',null,'Cannot create another owner');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin',null,true)$$,'22023',null,'Null expected role denied');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','seller','seller',true)$$,'22023',null,'No-op denied');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',false)$$,'40001',null,'Stale status denied');
select lives_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',true)$$,'Owner promotes seller');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',true)$$,'40001',null,'Duplicate stale request denied');
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(private.current_agency_role('e7200000-0000-4000-8000-000000000001'),'admin','New role is authoritative on next request');
select is(private.current_agency_role('e7200000-0000-4000-8000-000000000002'),'seller','Other agency role preserved');
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('test.demoted_invitation',public.begin_agency_user_invitation('e7200000-0000-4000-8000-000000000001','roles-5@example.test','QA','seller')::text,true);
reset role;
select public.finish_agency_user_invitation(current_setting('test.demoted_invitation')::uuid,'e7100000-0000-4000-8000-000000000005',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000002','seller','admin',true)$$,'Owner demotes active inviter');
select is((select is_active from public.memberships where id='e7300000-0000-4000-8000-000000000002'),true,'Demotion does not deactivate inviter');
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.accept_agency_user_invitation(current_setting('test.demoted_invitation')::uuid)$$,'42501',null,'Pending invitation cannot be accepted after inviter demotion');
reset role;
update public.memberships set is_active=false where id='e7300000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e7100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','seller','admin',false)$$,'Owner demotes inactive admin');
select is((select is_active from public.memberships where id='e7300000-0000-4000-8000-000000000003'),false,'Role change does not reactivate');
reset role;
create function pg_temp.reject_role_audit() returns trigger language plpgsql as $$ begin if new.action='membership.role_changed' then raise exception 'Synthetic audit failure' using errcode='22000'; end if; return new; end; $$;
create trigger reject_role_audit before insert on public.audit_events for each row execute function pg_temp.reject_role_audit();
set local role authenticated;
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',false)$$,'22000',null,'Audit failure rolls back role change');
select is((select role from public.memberships where id='e7300000-0000-4000-8000-000000000003'),'seller','Role preserved after audit failure');
select throws_ok($$update public.memberships set role='admin'$$,'42501',null,'Direct writes denied');
reset role;
select is((select count(*) from public.audit_events where agency_id='e7200000-0000-4000-8000-000000000001' and action='membership.role_changed' and actor_id='e7100000-0000-4000-8000-000000000001' and target_user_id='e7100000-0000-4000-8000-000000000003' and membership_id='e7300000-0000-4000-8000-000000000003' and previous_role is distinct from new_role),2::bigint,'Only actual transitions audited with actor, target and role pair');
update public.memberships set is_active=false where id='e7300000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',false)$$,'42501',null,'Revoked owner denied');
reset role;
update public.memberships set is_active=true where id='e7300000-0000-4000-8000-000000000001';
update public.agencies set is_active=false where id='e7200000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000003','admin','seller',false)$$,'P0002',null,'Inactive agency denied');
select throws_ok($$select public.set_agency_member_role('e7200000-0000-4000-8000-000000000002','e7300000-0000-4000-8000-000000000004','admin','seller',true)$$,'42501',null,'Foreign agency authority denied');
select * from finish(); rollback;
