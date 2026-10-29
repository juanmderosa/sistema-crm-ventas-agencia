# Prueba manual: invitación de superadministrador

## Servicios locales

Todo este recorrido funciona localmente, sin SMTP remoto ni despliegue. La entrega ya aplicó las migraciones y reinició Supabase local conservando sus volúmenes. En otro checkout:

1. Iniciá Supabase y ejecutá `npm run db:migrate`.
2. Si la instancia estaba iniciada antes de actualizar la plantilla/configuración Auth, ejecutá `npm run db:stop` y `npm run db:start`, sin reset ni `--no-backup`.
3. Configurá `APP_ORIGIN=http://127.0.0.1:3000` en `.env.local`, junto con las dos variables públicas de Supabase. No agregues claves privilegiadas a la aplicación.
4. En una terminal mantené `npm run functions:serve`. Usa el origen de `.env.local` y las claves administrativas que Supabase proporciona exclusivamente dentro de su runtime local.
5. En otra terminal ejecutá `npm run dev`. Abrí [la aplicación local](http://127.0.0.1:3000) y [Mailpit](http://127.0.0.1:54324).

Las credenciales y logs de solicitudes de la función no se imprimen. Si el servicio no está disponible, la aplicación debe mostrar un error de envío, nunca una confirmación ficticia.

## Preparación SQL

La cuenta Auth `qa-plataforma@example.test` debe existir. El correo nuevo `qa-invitado-superadmin@example.test` **no debe existir en Auth**: lo creará el flujo. La preparación conserva los perfiles existentes y aborta sin cambios si ya existe la asignación de plataforma o la agencia QA. Si usás una asignación/agencia anterior, no ejecutes esta limpieza.

```sql
do $$
declare platform_user uuid;
begin
  select id into strict platform_user from auth.users where email='qa-plataforma@example.test';
  if exists(select 1 from auth.users where lower(email)='qa-invitado-superadmin@example.test') then
    raise exception 'El destinatario ya existe. Elegí otro correo nuevo para probar invitaciones.';
  end if;
  if exists(select 1 from public.platform_admins where user_id=platform_user) then
    raise exception 'La asignación de plataforma ya existe. No se modificó ningún registro.';
  end if;
  if exists(select 1 from public.agencies where id='f7700000-0000-4000-8000-000000000001' or slug='qa-manual-invitaciones') then
    raise exception 'La agencia QA ya existe. No se modificó ningún registro.';
  end if;
  insert into public.profiles(id,display_name) values(platform_user,'Plataforma QA') on conflict(id) do nothing;
  insert into public.platform_admins(user_id) values(platform_user);
  insert into public.agencies(id,name,slug,ars_per_usd)
    values('f7700000-0000-4000-8000-000000000001','Agencia QA invitaciones','qa-manual-invitaciones',1000);
end;
$$;
```

## Invitación y aceptación

1. Ingresá como plataforma. En **Administrar agencias**, abrí **Superadministrador** de **Agencia QA invitaciones** y luego **Invitaciones por correo**.
2. Enviá el formulario vacío: debe validar nombre y correo. Completá nombre `Responsable QA nuevo` y correo `qa-invitado-superadmin@example.test`.
3. Al enviar debe mostrarse **Estado: Enviada** y una invitación pendiente. Todavía no debe existir ninguna membresía de esa agencia. Se crea un perfil, pero su correo aún no confirmado no permite asignarle el rol por la vía anterior.
4. En Mailpit abrí el mensaje **Invitación para administrar una agencia**. El enlace debe apuntar al origen configurado y a `/invitaciones/aceptar?invitation=...&token_hash=...`.
5. Copialo a otro navegador o ventana privada. Visitarlo o recargarlo no lo consume. Probá una contraseña de siete caracteres y confirmaciones diferentes; deben aparecer errores.
6. Guardá una contraseña de al menos ocho caracteres. Debe volver al login con **Invitación aceptada**. Ingresá con el correo nuevo y esa contraseña: debe abrir la agencia con rol **Superadministrador de agencia**.
7. Volver a usar el mismo enlace debe fallar. La cuenta nueva no obtiene administración de plataforma.

Estas consultas verifican estado y auditoría sin cambiar datos:

```sql
select id,email,status,user_id,expires_at,accepted_at
from public.agency_invitations
where agency_id='f7700000-0000-4000-8000-000000000001';

select user_id,role,is_active from public.memberships
where agency_id='f7700000-0000-4000-8000-000000000001';

select actor_id,target_user_id,invitation_id,action from public.audit_events
where agency_id='f7700000-0000-4000-8000-000000000001'
order by created_at,id;
```

Antes de aceptar: estado `sent`, cero membresías y evento `invitation.sent`. Después: estado `accepted`, una membresía activa y eventos `membership.superadmin_assigned` (autor de la invitación) e `invitation.accepted` (destinatario).

## Casos negativos

Probá cancelación/vencimiento **antes de aceptar**, o usá otra agencia vacía creada desde la aplicación. No se reemplazan responsables existentes.

- **Cancelar:** pulsá **Cancelar invitación**. El estado debe ser Cancelada y el enlace no puede otorgar acceso. La cuenta Auth no se borra. Podés volver a invitar el mismo correo si todavía no fue confirmado; usá el mensaje más reciente.
- **Cuenta existente:** enviá a una cuenta Auth confirmada de QA. Debe informar que existe, sin cambiar su contraseña ni asignar membresía. Si faltaba su perfil, se prepara para seleccionarla en **Usuarios existentes y responsable**; si el perfil ya existía, conserva su nombre. El intento queda No enviada. Esta vía no manda un correo para cambiar contraseñas existentes.
- **Falta de permiso:** sin sesión, las rutas de plataforma llevan a login; una cuenta común recibe 404. Invocar directamente la función sin JWT válido debe devolver 401; una cuenta común con JWT válido no puede reservar ni enviar invitaciones.
- **Enlace alterado:** cambiar el UUID por el de otra invitación para un destinatario distinto nunca debe asignar esa otra agencia. Cambiar el token o duplicar parámetros debe dar error. `next=https://example.org` no cambia el destino.
- **Vencimiento:** esperar más de una hora comprueba el vencimiento real. Para probar rápidamente solo la caducidad de la reserva de la aplicación, ejecutá lo siguiente; no equivale a verificar el reloj del token de Auth:

```sql
update public.agency_invitations set expires_at=now()-interval '1 second'
where agency_id='f7700000-0000-4000-8000-000000000001' and status='sent';
```

- **Revocación:** antes de aceptar, desactivá la asignación temporal del autor con la consulta siguiente. El destinatario puede llegar a definir su contraseña, pero no recibe membresía. Restaurala para probar la reanudación, siempre que la invitación siga vigente.

```sql
update public.platform_admins set is_active=false
where user_id=(select id from auth.users where email='qa-plataforma@example.test');
-- Restaurar únicamente la asignación temporal de esta prueba:
update public.platform_admins set is_active=true
where user_id=(select id from auth.users where email='qa-plataforma@example.test');
```

## Errores y reanudación

Auth/correo y PostgreSQL no comparten una transacción. Solo la creación de membresía, auditoría de aceptación y estado aceptado son atómicos.

- **Envío sin confirmar:** no asumas que el correo no salió. Recargá el estado; podés cancelar y volver a intentar. Un fallo de transporte no se presenta como envío exitoso ni como rechazo confirmado.
- **Contraseña definida pero aceptación rechazada:** usá **Ya definí mi contraseña**, ingresá con la cuenta invitada y volvé al enlace sin token. **Completar aceptación con mi sesión** funciona únicamente para esa identidad, si la reserva sigue enviada/vigente y la agencia y el autor siguen habilitados. Si hay otra cuenta abierta, cerrá su sesión desde Mi cuenta antes de ingresar como invitado.
- **El token se verificó pero no se pudo definir contraseña:** usá **Recuperar contraseña** y después ingresá para completar desde el enlace. Una cuenta confirmada no necesita que se le sobrescriba la contraseña mediante otra invitación.
- **Estado cancelado/vencido, o envío que no pudo vincularse a la identidad:** pedí a plataforma revisar/cancelar el intento. Si la cuenta ya quedó confirmada, intentar invitarla prepara su perfil sin tocar contraseña ni rol y permite continuar por selección de usuarios existentes. Ningún estado incompleto concede acceso automáticamente.

## Limpieza acotada

Solo si la preparación terminó sin error. Conserva usuarios Auth y perfiles, incluida la cuenta nueva para futuras pruebas. Para repetir el recorrido de cuenta nueva, elegí otro correo que todavía no exista. No borres cuentas preexistentes ni uses limpieza global.

```sql
begin;
delete from public.audit_events where agency_id='f7700000-0000-4000-8000-000000000001';
delete from public.memberships
where agency_id='f7700000-0000-4000-8000-000000000001'
  and user_id in (select user_id from public.agency_invitations where agency_id='f7700000-0000-4000-8000-000000000001');
delete from public.agency_invitations where agency_id='f7700000-0000-4000-8000-000000000001';
delete from public.agencies where id='f7700000-0000-4000-8000-000000000001' and slug='qa-manual-invitaciones';
delete from public.platform_admins where user_id=(select id from auth.users where email='qa-plataforma@example.test');
commit;
```

Si asignaste manualmente otro usuario o agregaste otras relaciones, sus claves foráneas pueden bloquear el borrado y revertirlo. No agregues cascade. Si usaste plataforma/agencia preexistentes, esta limpieza no corresponde.

## Pruebas automáticas y entorno remoto

Para Next E2E, iniciá la función en otra terminal con `npm run functions:serve -- --e2e`, y luego `npm run test:e2e -- --workers=2`. Para Worker local, detené esa función e iniciala con `--worker`; iniciá Wrangler como indica la guía de pruebas y ejecutá `npm run test:e2e:worker -- tests/e2e/superadmin-invitations.spec.ts --workers=1`. Se limita la concurrencia de navegadores para este flujo en el emulador; las pruebas internas de solicitudes simultáneas se conservan. El origen de los correos debe coincidir con el servidor que probás. La suite espera hasta que la función responda con su rechazo autenticado de preparación; una función ausente falla explícitamente. CI inicia la función local y oculta sus logs.

Para un proyecto remoto, quedan pendientes el despliegue independiente de la Edge Function, su `APP_ORIGIN` HTTPS, SMTP y la plantilla Invite de `supabase/templates/invite.html`. La lista de redirecciones debe permitir el origen real y la ruta fija `/invitaciones/aceptar?invitation=*`; el UUID variable lo genera el servidor. La función nunca toma el destino desde el cuerpo del cliente ni desde Host. No se hizo ningún despliegue en esta entrega.
