# Activación de agencias: prueba manual

Con Supabase local iniciado, ejecutar `npm run db:migrate` y `npm run dev`. Para la prueba opcional de correo, iniciar además `npm run functions:serve`. Usar las tres cuentas QA existentes en sesiones separadas. No ejecutar estos fixtures en producción.

## SQL de carga

Exige identidades distintas/confirmadas y aborta si existen las agencias de prueba. Conserva perfiles/accesos previos. Habilita plataforma para qa-plataforma solo si no tenía asignación; si tenía una deshabilitada, aborta para no reactivarla silenciosamente. La limpieza principal conserva esa asignación para proteger las que ya existían; al final hay una consulta opcional si esta carga fue quien la creó.

```sql
begin;
do $$
declare owner_id uuid; seller_id uuid; platform_id uuid;
begin
 select id into owner_id from auth.users where lower(email)='qa-a@example.test' and email_confirmed_at is not null;
 select id into seller_id from auth.users where lower(email)='qa-b@example.test' and email_confirmed_at is not null;
 select id into platform_id from auth.users where lower(email)='qa-plataforma@example.test' and email_confirmed_at is not null;
 if owner_id is null or seller_id is null or platform_id is null or owner_id=seller_id or owner_id=platform_id or seller_id=platform_id then
   raise exception 'Se requieren las tres identidades QA distintas y confirmadas';
 end if;
 if exists(select 1 from public.platform_admins where user_id=platform_id and not is_active) then
   raise exception 'La cuenta QA tiene una asignación de plataforma deshabilitada: no se modifica';
 end if;
 if exists(select 1 from public.agencies where id in ('f9940000-0000-4000-8000-000000000001','f9940000-0000-4000-8000-000000000002','f9940000-0000-4000-8000-000000000003') or slug in ('qa-manual-activacion','qa-manual-activacion-b','qa-manual-activacion-c')) then
   raise exception 'Las agencias QA ya existen: no se modifican datos previos';
 end if;
 insert into public.profiles(id,display_name) values(owner_id,'QA propietario'),(seller_id,'QA vendedor'),(platform_id,'QA plataforma') on conflict(id) do nothing;
 insert into public.platform_admins(user_id) values(platform_id) on conflict(user_id) do nothing;
 insert into public.agencies(id,name,slug,ars_per_usd) values
   ('f9940000-0000-4000-8000-000000000001','Agencia QA activación','qa-manual-activacion',1000),
   ('f9940000-0000-4000-8000-000000000002','Agencia QA activación B','qa-manual-activacion-b',1000),
   ('f9940000-0000-4000-8000-000000000003','Agencia QA activación C','qa-manual-activacion-c',1000);
 insert into public.memberships(agency_id,user_id,role,is_active) values
   ('f9940000-0000-4000-8000-000000000001',owner_id,'agency_superadmin',true),
   ('f9940000-0000-4000-8000-000000000002',owner_id,'admin',true),
   ('f9940000-0000-4000-8000-000000000001',seller_id,'seller',false),
   ('f9940000-0000-4000-8000-000000000002',seller_id,'seller',true);
end; $$;
commit;
```

## Pasos

1. Como qa-plataforma abrir `/plataforma/agencias`. Encontrar Agencia QA activación (usar paginación si hace falta). Está Activa y muestra **Desactivar agencia**.
2. Como qa-a abrir `/panel?agency=f9940000-0000-4000-8000-000000000001`. Mantener la página abierta. Desactivar A desde plataforma: el listado pasa a Inactiva y ofrece **Reactivar agencia**. Al recargar A con qa-a muestra **Acceso no disponible**. Su configuración y gestión de usuarios también quedan inaccesibles.
3. Como qa-a abrir `/panel?agency=f9940000-0000-4000-8000-000000000002`: B sigue disponible con rol Administrador. La cuenta/contraseña/sesión no se eliminaron ni se cambió la asignación de plataforma.
4. Reactivar A. Al volver a A con qa-a recupera Superadministrador sin otro login. Como qa-b, la membresía de A continúa inactiva y sin acceso; B sigue disponible como Vendedor. Reactivar una agencia no reactiva miembros individualmente.
5. Abrir dos pestañas del listado de plataforma. Desactivar A en una y reactivarla allí. Intentar desactivar desde la otra pestaña antigua: se rechaza y pide recargar aunque el estado visible vuelva a ser Activa. Tras recargar se puede decidir un nuevo cambio.
6. Como qa-a/qa-b abrir `/plataforma/agencias`: 404. Ser dueño/admin de una agencia no concede plataforma. Sin sesión deriva a login. Si se revoca plataforma mientras queda un botón abierto, el envío se rechaza y al recargar devuelve 404.

El estado cambia junto con su auditoría o no se guarda nada. Si falla la conexión, recargar para comprobar qué ocurrió antes de reintentar. La revocación se aplica en la próxima solicitud, no por una actualización en tiempo real de páginas ya abiertas.

## Invitaciones pendientes (opcional)

Con A activa, qa-a puede enviar una invitación de vendedor a un correo nuevo desde `/panel/usuarios?agency=f9940000-0000-4000-8000-000000000001`. Para propietario inicial, qa-plataforma puede invitar otro correo nuevo en la agencia C desde su enlace Superadministrador/Invitar. No aceptar todavía.

Desactivar A/C desde plataforma y luego abrir los correos. Definir la contraseña puede completarse en Auth, pero la membresía no debe concederse mientras la agencia esté inactiva. Reactivar A/C; ingresar con la cuenta invitada y elegir **Completar con mi sesión** (o **Ya definí mi contraseña** para propietario inicial), luego completar aceptación. Solo funciona si la invitación no venció, no se canceló, coincide la identidad y el autor conserva sus permisos. La reactivación no reenvía correos ni extiende vencimientos. Para probar expiración de Auth hay que esperar su hora real; los tests de timestamp de invitación no certifican ese reloj.

## Verificación SQL

```sql
select id,name,is_active,status_version,settings_version from public.agencies
where id in ('f9940000-0000-4000-8000-000000000001','f9940000-0000-4000-8000-000000000002','f9940000-0000-4000-8000-000000000003');
select agency_id,user_id,role,is_active from public.memberships
where agency_id in ('f9940000-0000-4000-8000-000000000001','f9940000-0000-4000-8000-000000000002','f9940000-0000-4000-8000-000000000003');
select action,actor_id,previous_is_active,new_is_active,created_at from public.audit_events
where agency_id in ('f9940000-0000-4000-8000-000000000001','f9940000-0000-4000-8000-000000000003') and action in ('agency.activated','agency.deactivated') order by created_at,id;
```

Cada transición real tiene autor, fecha y estado anterior/nuevo. Intentos rechazados no crean eventos. status_version rota en cada cambio; settings_version y las membresías no cambian por esta operación.

## SQL de limpieza

Solo para las tres agencias creadas arriba; conserva cuentas/perfiles (incluidas las invitadas), asignaciones de plataforma y otros accesos. Las FK bloquean referencias inesperadas sin forzar cascadas.

```sql
begin;
do $$
declare fixture_ids uuid[]:=array['f9940000-0000-4000-8000-000000000001','f9940000-0000-4000-8000-000000000002','f9940000-0000-4000-8000-000000000003']::uuid[];
begin
 if not exists(select 1 from public.agencies where id=fixture_ids[1] and slug='qa-manual-activacion')
 or not exists(select 1 from public.agencies where id=fixture_ids[2] and slug='qa-manual-activacion-b')
 or not exists(select 1 from public.agencies where id=fixture_ids[3] and slug='qa-manual-activacion-c') then
   raise exception 'No existen las tres agencias QA esperadas';
 end if;
 delete from public.audit_events where agency_id=any(fixture_ids);
 delete from public.agency_invitations where agency_id=any(fixture_ids);
 delete from public.agency_user_invitations where agency_id=any(fixture_ids);
 delete from public.agency_settings_history where agency_id=any(fixture_ids);
 delete from public.memberships where agency_id=any(fixture_ids);
 delete from public.agencies where id=any(fixture_ids);
end; $$;
commit;
```

Solo si esta preparación creó la asignación de plataforma y **no existía antes**, se puede retirar adicionalmente:

```sql
delete from public.platform_admins
where user_id=(select id from auth.users where lower(email)='qa-plataforma@example.test');
```

No se elimina la agencia ni sus datos desde la interfaz: es una suspensión de acceso. Catálogo público, inventario/CRM y otros módulos futuros deben verificar agencia activa cuando se implementen; esta entrega no certifica esas funcionalidades inexistentes ni un despliegue remoto.
