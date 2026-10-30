# Miembros de agencia: prueba manual

Con Supabase local iniciado, ejecutar `npm run db:migrate` y `npm run dev`. La gestión de miembros no necesita correo/Edge. Usar sesiones separadas para las tres cuentas QA ya creadas. No ejecutar estos fixtures en producción.

## SQL de carga

Exige tres identidades confirmadas distintas; conserva perfiles/asignaciones previas y aborta si ya existen las agencias de prueba.

```sql
begin;
do $$
declare owner_id uuid; admin_id uuid; seller_id uuid;
begin
 select id into owner_id from auth.users where lower(email)='qa-a@example.test' and email_confirmed_at is not null;
 select id into admin_id from auth.users where lower(email)='qa-b@example.test' and email_confirmed_at is not null;
 select id into seller_id from auth.users where lower(email)='qa-plataforma@example.test' and email_confirmed_at is not null;
 if owner_id is null or admin_id is null or seller_id is null or owner_id=admin_id or owner_id=seller_id or admin_id=seller_id then
   raise exception 'Se requieren las tres identidades QA distintas y confirmadas';
 end if;
 if exists(select 1 from public.agencies where id in ('f9900000-0000-4000-8000-000000000001','f9900000-0000-4000-8000-000000000002') or slug in ('qa-manual-miembros','qa-manual-miembros-b')) then
   raise exception 'Las agencias QA ya existen: no se modifican datos previos';
 end if;
 insert into public.profiles(id,display_name) values (owner_id,'QA superadministrador'),(admin_id,'QA administrador'),(seller_id,'QA vendedor') on conflict(id) do nothing;
 insert into public.agencies(id,name,slug,ars_per_usd) values
   ('f9900000-0000-4000-8000-000000000001','Agencia QA miembros','qa-manual-miembros',1000),
   ('f9900000-0000-4000-8000-000000000002','Agencia QA miembros B','qa-manual-miembros-b',1000);
 insert into public.memberships(agency_id,user_id,role) values
   ('f9900000-0000-4000-8000-000000000001',owner_id,'agency_superadmin'),
   ('f9900000-0000-4000-8000-000000000001',admin_id,'admin'),
   ('f9900000-0000-4000-8000-000000000001',seller_id,'seller'),
   ('f9900000-0000-4000-8000-000000000002',seller_id,'admin');
end; $$;
commit;
```

## Pasos

1. Como qa-a abrir `/panel?agency=f9900000-0000-4000-8000-000000000001` y seguir **Ver miembros de agencia**. Se muestran nombre, identificador, rol y estado de los tres miembros. Si sus perfiles ya existían se conservan sus nombres: distinguirlos por identificador/rol. La propia membresía no tiene botón; admin y vendedor ofrecen **Desactivar**.
2. Como qa-b abrir `/panel/usuarios/miembros?agency=f9900000-0000-4000-8000-000000000001`. Solo el vendedor tiene botón. No puede cambiar admins ni superadministradores ni su propia membresía.
3. Mantener A abierta con qa-plataforma usando la URL explícita del paso 1. Desactivar al vendedor como qa-b. El listado cambia a **Estado: Inactivo** y **Reactivar**. Al recargar A con qa-plataforma muestra **Acceso no disponible**. Abrir `/panel?agency=f9900000-0000-4000-8000-000000000002`: B sigue disponible como Administrador. Cuenta, contraseña y plataforma no se modificaron.
4. Reactivar al vendedor como qa-b. Al volver a A recupera el mismo rol, sin crear otra membresía.
5. Como qa-a desactivar a qa-b. Su listado abierto no cambia en tiempo real, pero cualquier nueva acción falla y al recargar la gestión devuelve 404. Reactivarlo como qa-a y verificar que puede volver con la misma sesión.
6. Como vendedor de A, abrir directamente la gestión de A: 404. Una sesión anónima deriva a login. Plataforma sola no autoriza. Agencia ajena, `agency=bad`, agency duplicado y `page=0` se rechazan. El listado tiene veinte miembros por página; Anterior/Siguiente conservan la agencia.
7. Abrir el vendedor activo en dos pestañas del gestor. Desactivarlo en una e intentar desactivarlo en la otra: muestra un conflicto y pide recargar, sin duplicar auditoría. Recargar y reactivar.

Ante un fallo de conexión, recargar para verificar el estado real. Si una invitación mantiene ocupado al administrador que se intenta revocar, se pide recargar/reintentar en vez de provocar bloqueo mutuo. Ese cruce se reproduce automáticamente con `npm run db:test:member-concurrency`.

## Verificación SQL

```sql
select m.id,m.user_id,p.display_name,m.role,m.is_active
from public.memberships m join public.profiles p on p.id=m.user_id
where m.agency_id in ('f9900000-0000-4000-8000-000000000001','f9900000-0000-4000-8000-000000000002')
order by m.agency_id,m.created_at,m.id;

select action,actor_id,target_user_id,membership_id,created_at
from public.audit_events
where agency_id='f9900000-0000-4000-8000-000000000001'
order by created_at,id;
```

Cada cambio real registra membership.deactivated o membership.activated con autor, destinatario y membresía. Los rechazos no generan eventos/cambios. La lectura de auditoría de la aplicación sigue siendo exclusiva de plataforma; estas consultas son inspección SQL local.

## SQL de limpieza

Solo para las dos agencias anteriores. Conserva Auth, perfiles y plataforma. Las FK bloquean la limpieza si otras funcionalidades agregaron referencias; no se fuerzan cascadas.

```sql
begin;
do $$
begin
 if not exists(select 1 from public.agencies where id='f9900000-0000-4000-8000-000000000001' and slug='qa-manual-miembros')
 or not exists(select 1 from public.agencies where id='f9900000-0000-4000-8000-000000000002' and slug='qa-manual-miembros-b') then
   raise exception 'No existen las dos agencias QA esperadas';
 end if;
 delete from public.audit_events where agency_id in ('f9900000-0000-4000-8000-000000000001','f9900000-0000-4000-8000-000000000002');
 delete from public.memberships where agency_id in ('f9900000-0000-4000-8000-000000000001','f9900000-0000-4000-8000-000000000002');
 delete from public.agencies where id in ('f9900000-0000-4000-8000-000000000001','f9900000-0000-4000-8000-000000000002');
end; $$;
commit;
```

No se implementan cambios de rol, eliminación de cuentas ni reemplazo del superadministrador. Inventario/CRM/rotación de vendedores todavía no están implementados y no se certifican en esta prueba.
