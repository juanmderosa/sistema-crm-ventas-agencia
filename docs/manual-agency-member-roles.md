# Cambios de rol: prueba manual

Con Supabase local iniciado, ejecutar `npm run db:migrate` y `npm run dev`. No necesita correo/Edge para cambiar roles. Usar las tres cuentas QA existentes en sesiones de navegador separadas. No ejecutar estos fixtures en producción.

## SQL de carga

Exige las tres identidades QA distintas y confirmadas, conserva sus perfiles y accesos anteriores y aborta si ya existen las agencias QA de roles.

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
 if exists(select 1 from public.agencies where id in ('f9910000-0000-4000-8000-000000000001','f9910000-0000-4000-8000-000000000002') or slug in ('qa-manual-roles','qa-manual-roles-b')) then
   raise exception 'Las agencias QA ya existen: no se modifican datos previos';
 end if;
 insert into public.profiles(id,display_name) values (owner_id,'QA superadministrador'),(admin_id,'QA administrador'),(seller_id,'QA vendedor') on conflict(id) do nothing;
 insert into public.agencies(id,name,slug,ars_per_usd) values
   ('f9910000-0000-4000-8000-000000000001','Agencia QA roles','qa-manual-roles',1000),
   ('f9910000-0000-4000-8000-000000000002','Agencia QA roles B','qa-manual-roles-b',1000);
 insert into public.memberships(agency_id,user_id,role) values
   ('f9910000-0000-4000-8000-000000000001',owner_id,'agency_superadmin'),
   ('f9910000-0000-4000-8000-000000000001',admin_id,'admin'),
   ('f9910000-0000-4000-8000-000000000001',seller_id,'seller'),
   ('f9910000-0000-4000-8000-000000000002',seller_id,'admin');
end; $$;
commit;
```

## Pasos y resultados

1. Como qa-a abrir `/panel/usuarios/miembros?agency=f9910000-0000-4000-8000-000000000001`. El superadministrador no tiene formulario sobre su propia membresía; admin/vendedor muestran **Nuevo rol** y **Guardar rol**. El botón queda deshabilitado mientras no se elija un rol distinto. Los perfiles previos conservan su nombre: distinguir por rol e identificador.
2. Abrir A con qa-plataforma mediante `/panel?agency=f9910000-0000-4000-8000-000000000001`: comienza como Vendedor. Como qa-a elegir Administrador para ese miembro y guardar. Al recargar A con qa-plataforma obtiene el rol Administrador y acceso a gestión de usuarios, pero no puede cambiar roles. Su estado sigue Activo. La agencia B (`/panel?agency=f9910000-0000-4000-8000-000000000002`) conserva su rol Administrador.
3. Como qa-a volver a cambiarlo a Vendedor. Al recargar su gestión de A devuelve 404; al abrir su panel A sigue entrando como vendedor y B sigue disponible como administrador. No cambia su contraseña ni se recrea la membresía.
4. Como qa-b (Administrador en A), comprobar que no hay formularios para cambiar roles. Tampoco puede promover vendedores mediante el RPC. El superadministrador de otra agencia, vendedor, usuario sin membresía y plataforma sola no autorizan esta operación.
5. Como qa-a desactivar al vendedor, luego cambiar su rol a Administrador. Debe permanecer Inactivo y sin acceso a A. Reactivarlo por separado para restaurar acceso con el nuevo rol. El cambio de rol nunca activa/reactiva por sí solo.
6. Abrir dos pestañas de qa-a con el mismo miembro. Cambiar el rol en una y luego intentar guardar en la otra: se rechaza y pide recargar. También se rechaza si otra pestaña cambió el estado activo/inactivo. Tras recargar se puede decidir un nuevo cambio sobre el estado actual.
7. Si se revoca al superadministrador mientras deja un formulario abierto, el envío se rechaza. Los superadministradores y la propia membresía están protegidos incluso mediante petición directa. Si una invitación mantiene ocupado al miembro, se pide recargar/reintentar sin bloqueo mutuo; la prueba reproducible es `npm run db:test:member-concurrency`.

Los permisos nuevos aplican en la próxima solicitud, sin volver a iniciar sesión. La página ya abierta no se actualiza en tiempo real. Una invitación pendiente enviada por un administrador que pasó a vendedor no puede aceptarse mientras el autor carezca de permiso; no se cancela automáticamente su registro.

## Verificación SQL

```sql
select id,user_id,role,is_active from public.memberships where agency_id in ('f9910000-0000-4000-8000-000000000001','f9910000-0000-4000-8000-000000000002') order by agency_id,user_id;
select action,actor_id,target_user_id,membership_id,previous_role,new_role,created_at from public.audit_events where agency_id='f9910000-0000-4000-8000-000000000001' order by created_at,id;
```

Cada cambio real de rol genera membership.role_changed con autor, destinatario, membresía y los dos roles. Intentos rechazados no cambian datos ni duplican auditoría. Los eventos de activación/desactivación tienen ambos campos de rol nulos. La lectura de auditoría de aplicación sigue siendo exclusiva de plataforma; estas consultas son inspección SQL local.

## SQL de limpieza

Solo para las dos agencias creadas arriba. Conserva Auth/perfiles/plataforma y accesos previos. Las FK bloquean referencias de otros flujos; no se fuerzan cascadas.

```sql
begin;
do $$
begin
 if not exists(select 1 from public.agencies where id='f9910000-0000-4000-8000-000000000001' and slug='qa-manual-roles')
 or not exists(select 1 from public.agencies where id='f9910000-0000-4000-8000-000000000002' and slug='qa-manual-roles-b') then
   raise exception 'No existen las dos agencias QA esperadas';
 end if;
 delete from public.audit_events where agency_id in ('f9910000-0000-4000-8000-000000000001','f9910000-0000-4000-8000-000000000002');
 delete from public.memberships where agency_id in ('f9910000-0000-4000-8000-000000000001','f9910000-0000-4000-8000-000000000002');
 delete from public.agencies where id in ('f9910000-0000-4000-8000-000000000001','f9910000-0000-4000-8000-000000000002');
end; $$;
commit;
```

No se agregan roles nuevos, reemplazo de superadministrador, eliminación de cuentas ni migración de responsabilidades de inventario/CRM (todavía no implementadas).
