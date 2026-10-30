# Prueba manual: invitaciones de usuarios de agencia

## Preparación local

Con Docker/Supabase iniciados, ejecutar `npm run db:migrate`. La configuración local incluye las plantillas Invite y Magic Link; si todavía no se aplicaron, usar `npm run db:stop` y `npm run db:start` conservando volúmenes. No usar reset ni --no-backup. Mantener dos terminales abiertas:

```powershell
npm run functions:serve
```

```powershell
npm run dev
```

Abrir la aplicación en el origen de APP_ORIGIN (habitualmente http://127.0.0.1:3000) y el correo local en http://127.0.0.1:54324. Las funciones deben reiniciarse si se cambia el origen. El helper ahora sirve ambas funciones.

## SQL de carga

Ejecutar en Supabase local. Resuelve las tres identidades QA ya creadas, exige correos confirmados y aborta si falta alguna o si la agencia de prueba ya existe. Conserva perfiles previos. No modifica membresías de agencias existentes ni asignaciones de plataforma. Los nombres de correos son los usados en las guías anteriores.

```sql
begin;
do $$
declare owner_id uuid; admin_id uuid; seller_id uuid;
begin
 select id into owner_id from auth.users where lower(email)='qa-a@example.test' and email_confirmed_at is not null;
 select id into admin_id from auth.users where lower(email)='qa-b@example.test' and email_confirmed_at is not null;
 select id into seller_id from auth.users where lower(email)='qa-plataforma@example.test' and email_confirmed_at is not null;
 if owner_id is null or admin_id is null or seller_id is null
 or owner_id=admin_id or owner_id=seller_id or admin_id=seller_id then
   raise exception 'Se requieren las tres identidades QA distintas y confirmadas';
 end if;
 if exists(select 1 from public.agencies where id in ('f8800000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002') or slug in ('qa-manual-usuarios','qa-manual-usuarios-b')) then
   raise exception 'La agencia QA ya existe: no se modifica su estado previo';
 end if;
 insert into public.profiles(id,display_name) values
   (owner_id,'QA superadministrador'),(admin_id,'QA administrador'),(seller_id,'QA vendedor') on conflict(id) do nothing;
 insert into public.agencies(id,name,slug,ars_per_usd) values
   ('f8800000-0000-4000-8000-000000000001','Agencia QA usuarios','qa-manual-usuarios',1000),
   ('f8800000-0000-4000-8000-000000000002','Agencia QA usuarios B','qa-manual-usuarios-b',1000);
 insert into public.memberships(agency_id,user_id,role) values
   ('f8800000-0000-4000-8000-000000000001',owner_id,'agency_superadmin'),
   ('f8800000-0000-4000-8000-000000000001',admin_id,'admin'),
   ('f8800000-0000-4000-8000-000000000002',seller_id,'seller');
end; $$;
commit;
```

## Pasos y resultados

1. Ingresar con qa-a y abrir `/panel?agency=f8800000-0000-4000-8000-000000000001`. Seguir **Administrar invitaciones de usuarios**. Se muestran nombre de agencia, formulario y listado vacío. El selector ofrece Vendedor y Administrador. Probar nombre vacío/correo inválido antes de enviar.
2. Invitar una dirección nueva, por ejemplo qa-vendedor-nuevo@example.test, como Vendedor. Si ya fue usada, elegir una dirección nueva. Debe aparecer **Estado: Enviada**, sin acceso todavía. La consulta de verificación de abajo muestra estado sent y cero membresías para ese destinatario.
3. Abrir el correo local y copiar su enlace a otro navegador o ventana privada. Abrirlo no acepta nada. Completar contraseña de ocho caracteres y confirmación; aceptar. Se vuelve al login. Ingresar con la cuenta nueva: rol Vendedor, sin enlace para administrar usuarios. Reusar el correo falla explícitamente.
4. Como qa-b, abrir la misma gestión: solo ofrece Vendedor. No muestra las invitaciones de administradores ajenos. Invitar otra dirección nueva como vendedor. El servidor y PostgreSQL también rechazan un intento de enviar role=admin, no solo el selector.
5. Como qa-a, invitar un Administrador con otra dirección nueva y verificar su aceptación. Al ingresar, puede invitar vendedores pero no administradores.
6. Cancelar una invitación enviada antes de aceptar. Debe quedar **Cancelada**. El correo anterior no concede acceso. Para reenviar, enviar una nueva invitación tras cancelar o vencer la anterior; queda un registro nuevo. Nunca se cambia una membresía previa ni se reactiva una inactiva.
7. Como qa-a, invitar a qa-plataforma@example.test como Vendedor. La carga la dejó solo en la agencia B, lista para este caso. Se envía un correo con **Aceptar invitación** sin pedir nueva contraseña. Al aceptar se vuelve al login; la contraseña anterior y su membresía de vendedor en B siguen funcionando. Un miembro actual de A se rechaza incluso si está inactivo.
8. Como qa-plataforma, que aquí tiene rol vendedor, abrir directamente `/panel/usuarios?agency=f8800000-0000-4000-8000-000000000001`: debe devolver 404, aunque tenga asignación de plataforma en otro contexto. Una sesión anónima deriva a login. Agencia ajena, selección duplicada y página inválida también se rechazan.

El listado tiene veinte registros por página y navegación Anterior/Siguiente cuando corresponde. El estado del autor, agencia e invitación se revalida al enviar/aceptar; cambios de permisos aplican en la próxima solicitud. No hay actualización en tiempo real de una página ya abierta.

## Verificación y aceptación interrumpida

```sql
select i.id,i.email,i.role,i.status,i.expires_at,m.id as membership_id,m.role as granted_role
from public.agency_user_invitations i
left join public.memberships m on m.agency_id=i.agency_id and m.user_id=i.user_id
where i.agency_id='f8800000-0000-4000-8000-000000000001'
order by i.created_at;

select action,actor_id,target_user_id,user_invitation_id
from public.audit_events
where agency_id='f8800000-0000-4000-8000-000000000001'
order by created_at,id;
```

Para probar revocación: después de enviar como qa-b, ejecutar la primera consulta, intentar aceptar y luego restaurar con la segunda. Solo se afecta la agencia QA.

```sql
update public.memberships set is_active=false
where agency_id='f8800000-0000-4000-8000-000000000001'
and user_id=(select id from auth.users where email='qa-b@example.test');

-- Restaurar tras comprobar el rechazo:
update public.memberships set is_active=true
where agency_id='f8800000-0000-4000-8000-000000000001'
and user_id=(select id from auth.users where email='qa-b@example.test');
```

Si la contraseña se guardó pero la aceptación falló, ingresar con esa contraseña, volver al enlace y elegir **Completar con mi sesión**, luego **Completar aceptación con mi sesión**. Otra identidad no puede completarla. Si el token se consumió antes de poder guardar contraseña, usar Recuperar contraseña. La invitación debe seguir enviada/vigente y su autor conservar los permisos.

Para comprobar el vencimiento de la reserva rápidamente, afectar solo invitaciones QA pendientes:

```sql
update public.agency_user_invitations set expires_at=now()-interval '1 second'
where agency_id='f8800000-0000-4000-8000-000000000001' and status in ('sending','sent');
```

Esto no prueba el reloj del token de Auth. Para ese control se debe esperar una hora real y probar un correo sin consumir. Un error de transporte queda como **Envío sin confirmar**: recargar/revisar y cancelar antes de repetir. No implica que el correo no haya salido.

## SQL de limpieza

Solo para las dos agencias creadas por el SQL anterior. Conserva todas las cuentas Auth y perfiles, incluidas las invitadas, y las asignaciones de plataforma. Las FK bloquean la limpieza si otro flujo agregó referencias; no se borran en cascada. Las cuentas invitadas conservadas cuentan como existentes en la próxima prueba.

```sql
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
```

## Remoto pendiente

No se desplegó. Antes de usar un proyecto remoto: aplicar migraciones, desplegar ambas funciones con sus verificaciones explícitas de identidad, configurar APP_ORIGIN HTTPS y SMTP, habilitar las URL exactas de aceptación y copiar las plantillas Invite y Magic Link. La configuración local no modifica ese proyecto. La aceptación de cuentas existentes usa el [OTP sin crear usuarios](https://supabase.com/docs/reference/javascript/auth-signinwithotp) y [verificación de hash por correo](https://supabase.com/docs/guides/auth/auth-email-passwordless), siempre sin instalar una sesión temporal en el navegador.
