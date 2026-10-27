begin;

-- Perfiles: conserva los que ya existan.
insert into public.profiles (id, display_name)
values
  ('7273a9ef-c0a6-438a-bec1-ec4f1d45534f', 'QA Usuario A'),
  ('bd341804-19eb-4561-9857-82e791e89470', 'QA Usuario B'),
  ('21bd210a-03d5-4543-80c1-522e6f0f2e48', 'QA Administrador de plataforma')
on conflict (id) do nothing;

-- Agencias de prueba.
insert into public.agencies
  (id, name, slug, is_active, ars_per_usd)
values
  (
    'a1100000-0000-4000-8000-000000000001',
    'Agencia QA A',
    'qa-manual-agencia-a',
    true,
    1000
  ),
  (
    'a1100000-0000-4000-8000-000000000002',
    'Agencia QA B',
    'qa-manual-agencia-b',
    true,
    1000
  )
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  is_active = excluded.is_active,
  ars_per_usd = excluded.ars_per_usd;

-- Membresías de los dos primeros usuarios.
insert into public.memberships
  (id, agency_id, user_id, role, is_active)
values
  (
    'b1100000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    '7273a9ef-c0a6-438a-bec1-ec4f1d45534f',
    'admin',
    true
  ),
  (
    'b1100000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000002',
    '7273a9ef-c0a6-438a-bec1-ec4f1d45534f',
    'seller',
    true
  ),
  (
    'b1100000-0000-4000-8000-000000000003',
    'a1100000-0000-4000-8000-000000000002',
    'bd341804-19eb-4561-9857-82e791e89470',
    'seller',
    true
  )
on conflict (agency_id, user_id) do update
set
  role = excluded.role,
  is_active = excluded.is_active;

-- Plataforma: asignación independiente para el tercer usuario.
insert into public.platform_admins (user_id, is_active)
values ('21bd210a-03d5-4543-80c1-522e6f0f2e48', true)
on conflict (user_id) do update
set is_active = excluded.is_active;

commit;