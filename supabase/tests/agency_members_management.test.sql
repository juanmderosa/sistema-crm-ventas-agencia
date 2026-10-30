begin;
create extension if not exists pgtap with schema extensions;
select plan(33);
insert into auth.users(id,email,email_confirmed_at,encrypted_password)
select ('e6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'member-'||n||'@example.test',now(),'synthetic' from generate_series(1,5) n;
insert into public.profiles(id,display_name) select id,'QA miembro' from auth.users where id::text like 'e6100000-%';
insert into public.agencies(id,name,slug,ars_per_usd) values
 ('e6200000-0000-4000-8000-000000000001','QA miembros','qa-members-db',1000),
 ('e6200000-0000-4000-8000-000000000002','QA miembros B','qa-members-b-db',1000);
insert into public.memberships(id,agency_id,user_id,role) values
 ('e6300000-0000-4000-8000-000000000001','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','agency_superadmin'),
 ('e6300000-0000-4000-8000-000000000002','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000002','admin'),
 ('e6300000-0000-4000-8000-000000000003','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000003','seller'),
 ('e6300000-0000-4000-8000-000000000004','e6200000-0000-4000-8000-000000000002','e6100000-0000-4000-8000-000000000003','admin'),
 ('e6300000-0000-4000-8000-000000000005','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000004','admin');
insert into public.platform_admins(user_id) values ('e6100000-0000-4000-8000-000000000005');
set local role anon;
select throws_ok($$select public.list_agency_members('e6200000-0000-4000-8000-000000000001',0)$$,'42501',null,'Anonymous cannot read roster');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'42501',null,'Anonymous cannot change status');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.list_agency_members('e6200000-0000-4000-8000-000000000001',0)$$,'42501',null,'Platform alone cannot read agency roster through management API');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'42501',null,'Platform alone cannot change membership');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"agency_superadmin"}}',true);
select throws_ok($$select public.list_agency_members('e6200000-0000-4000-8000-000000000001',0)$$,'42501',null,'Seller metadata cannot authorize');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.list_agency_members('e6200000-0000-4000-8000-000000000001',0)),4::bigint,'Admin sees only the selected agency roster');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000005',false,true)$$,'42501',null,'Admin cannot change peer admin');
select throws_ok($$select public.list_agency_members('e6200000-0000-4000-8000-000000000001',-1)$$,'22023',null,'Negative offset denied');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',null,true)$$,'22023',null,'Null state denied');
select throws_ok($$select public.list_agency_members('e6200000-0000-4000-8000-000000000002',0)$$,'42501',null,'Foreign roster denied');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000001',false,true)$$,'42501',null,'Owner protected');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000002',false,true)$$,'42501',null,'Own membership protected');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000004',false,true)$$,'P0002',null,'Foreign membership ID denied');
select lives_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'Admin deactivates seller');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'40001',null,'Stale submission rejected');
select is((select count(*) from public.list_agency_members('e6200000-0000-4000-8000-000000000001',0) where not is_active),1::bigint,'Inactive member remains visible');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(private.current_agency_role('e6200000-0000-4000-8000-000000000001'),null,'Deactivation revokes agency access');
select is(private.current_agency_role('e6200000-0000-4000-8000-000000000002'),'admin','Other agency access preserved');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',true,false)$$,'Admin reactivates seller');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',true,true)$$,'22023',null,'No-op rejected');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000002',false,true)$$,'Owner deactivates admin');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'42501',null,'Revoked admin cannot change another member');
select set_config('request.jwt.claims','{"sub":"e6100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000002',true,false)$$,'Owner reactivates admin');
reset role;
create function pg_temp.reject_member_audit() returns trigger language plpgsql as $$ begin if new.action='membership.deactivated' then raise exception 'Synthetic audit failure' using errcode='22000'; end if; return new; end; $$;
create trigger reject_member_audit before insert on public.audit_events for each row execute function pg_temp.reject_member_audit();
set local role authenticated;
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'22000',null,'Audit failure rolls back status');
select is((select is_active from public.list_agency_members('e6200000-0000-4000-8000-000000000001',0) where id='e6300000-0000-4000-8000-000000000003'),true,'Status preserved after audit failure');
select throws_ok($$update public.memberships set is_active=false$$,'42501',null,'Direct writes still denied');
reset role;
select is((select count(*) from public.audit_events where agency_id='e6200000-0000-4000-8000-000000000001'),4::bigint,'Only actual transitions are audited');
select is((select count(*) from public.audit_events where membership_id='e6300000-0000-4000-8000-000000000003' and actor_id='e6100000-0000-4000-8000-000000000002' and target_user_id='e6100000-0000-4000-8000-000000000003'),2::bigint,'Audit binds actor, target and membership');
update public.agencies set is_active=false where id='e6200000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.list_agency_members('e6200000-0000-4000-8000-000000000001',0)$$,'42501',null,'Inactive agency roster denied');
select throws_ok($$select public.set_agency_member_active('e6200000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000003',false,true)$$,'P0002',null,'Inactive agency mutation denied');
reset role;
update public.agencies set is_active=true where id='e6200000-0000-4000-8000-000000000001';
insert into auth.users(id,email) select ('e6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'member-page-'||n||'@example.test' from generate_series(10,35) n;
insert into public.profiles(id,display_name) select id,'QA paginación' from auth.users where id::text like 'e6100000-%' and email like 'member-page-%';
insert into public.memberships(agency_id,user_id,role) select 'e6200000-0000-4000-8000-000000000001',id,'seller' from auth.users where id::text like 'e6100000-%' and email like 'member-page-%';
set local role authenticated;
select is((select count(*) from public.list_agency_members('e6200000-0000-4000-8000-000000000001',0)),21::bigint,'Roster read is bounded with next-page sentinel');
select is((select count(*) from public.list_agency_members('e6200000-0000-4000-8000-000000000001',20)),10::bigint,'Second page reads remaining members');
select is((select count(*) from public.list_agency_members('e6200000-0000-4000-8000-000000000001',1000)),0::bigint,'Empty page is explicit');
select * from finish(); rollback;
