# Configuración de agencia: prueba manual

Con Supabase local iniciado, ejecutar `npm run db:migrate` y `npm run dev`. La edición no necesita correo/Edge. Usar las tres cuentas QA existentes en sesiones separadas. No ejecutar estos fixtures en producción.

## SQL de carga

Exige las tres identidades confirmadas distintas, conserva sus perfiles y accesos previos, y aborta si ya existen las agencias QA.

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
 if exists(select 1 from public.agencies where id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002') or slug in ('qa-manual-ajustes','qa-manual-ajustes-b')) then
   raise exception 'Las agencias QA ya existen: no se modifican datos previos';
 end if;
 insert into public.profiles(id,display_name) values (owner_id,'QA superadministrador'),(admin_id,'QA administrador'),(seller_id,'QA vendedor') on conflict(id) do nothing;
 insert into public.agencies(id,name,slug,ars_per_usd) values
   ('f9920000-0000-4000-8000-000000000001','Agencia QA ajustes','qa-manual-ajustes',1000),
   ('f9920000-0000-4000-8000-000000000002','Agencia QA ajustes B','qa-manual-ajustes-b',1000);
 insert into public.memberships(agency_id,user_id,role) values
   ('f9920000-0000-4000-8000-000000000001',owner_id,'agency_superadmin'),
   ('f9920000-0000-4000-8000-000000000001',admin_id,'admin'),
   ('f9920000-0000-4000-8000-000000000001',seller_id,'seller'),
   ('f9920000-0000-4000-8000-000000000002',seller_id,'admin');
end; $$;
commit;
```

## Pasos y resultados

1. Como qa-a abrir `/panel?agency=f9920000-0000-4000-8000-000000000001` y seguir **Configurar agencia**. Se muestra nombre, identificador público de lectura, cotización y un historial vacío. **Guardar configuración** queda deshabilitado mientras no haya cambios.
2. Probar nombre vacío, cotización cero, negativa, exponente (`1e3`) y más de seis decimales. Se muestran errores sin guardar. Corregir nombre y usar `1234,123456`: se guarda como `1234.123456`, sin pasar por números de coma flotante. El nombre nuevo aparece en el encabezado y al volver al panel.
3. Como qa-b abrir `/panel/agencia?agency=f9920000-0000-4000-8000-000000000001`. También puede editar. Cambiar solo el nombre: el historial muestra el nombre anterior/nuevo y la misma cotización en ambos valores. Después cambiar solo la cotización y comprobar autor, fecha y ambos importes. Las fechas visibles están en horario de Argentina.
4. Como qa-plataforma, vendedor en A, abrir directamente la configuración de A: 404. Abrir `/panel/agencia?agency=f9920000-0000-4000-8000-000000000002`: sí puede editar B porque tiene rol administrador allí. Los cambios en B no aparecen en el historial de A ni modifican su cotización. Una asignación de plataforma por sí sola no permite editar.
5. Abrir la configuración de A en dos pestañas de qa-a/qa-b. Guardar un cambio en una y luego intentar guardar desde la otra: se rechaza y pide recargar. Incluso si otro usuario cambia y restaura los valores, el formulario inicial sigue desactualizado. Al recargar se puede tomar una nueva decisión con los valores actuales.
6. Si el administrador pierde su membresía o la agencia queda inactiva mientras tiene un formulario abierto, no puede guardar. El historial tiene veinte filas por página con Anterior/Siguiente. Agencia ajena, agency duplicado, `agency=bad` y `page=0` se rechazan; la sesión anónima deriva a login.
7. Para verificar precisión en el límite, guardar `999999999999,123456` y comprobar la consulta SQL siguiente. Si hubo un error de conexión, recargar antes de reintentar: no se inventa éxito ni se sobrescriben cambios de otro usuario.

El identificador público, estado de agencia, roles y membresías no se editan desde esta pantalla. Un cambio de cotización no reescribe precios base de vehículos; inventario/conversión de precios todavía son otras funcionalidades pendientes.

## Verificación SQL

```sql
select id,name,slug,ars_per_usd::text,settings_version from public.agencies where id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
select id,actor_id,previous_name,new_name,previous_ars_per_usd::text,new_ars_per_usd::text,created_at from public.agency_settings_history where agency_id='f9920000-0000-4000-8000-000000000001' order by created_at,id;
select action,actor_id,settings_change_id from public.audit_events where agency_id='f9920000-0000-4000-8000-000000000001' order by created_at,id;
```

Cada cambio real guarda una fila de historial y un evento agency.settings_updated ligados por agencia/settings_change_id, con el autor de la sesión. Los intentos rechazados no generan registros. La versión actual coincide con el ID del último cambio (antes del primer cambio es un identificador inicial independiente). El historial de la aplicación solo es visible a administradores/superadministradores de esa agencia; auditoría global sigue siendo de plataforma.

## SQL de limpieza

Conserva Auth, perfiles, plataforma y accesos de otras agencias. Solo elimina las dos agencias creadas aquí; las FK bloquean referencias de otros flujos, sin cascadas.

```sql
begin;
do $$
begin
 if not exists(select 1 from public.agencies where id='f9920000-0000-4000-8000-000000000001' and slug='qa-manual-ajustes')
 or not exists(select 1 from public.agencies where id='f9920000-0000-4000-8000-000000000002' and slug='qa-manual-ajustes-b') then
   raise exception 'No existen las dos agencias QA esperadas';
 end if;
 delete from public.audit_events where agency_id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
 delete from public.agency_settings_history where agency_id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
 delete from public.memberships where agency_id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
 delete from public.agencies where id in ('f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000002');
end; $$;
commit;
```

La concurrencia y el rollback ante fallo de auditoría se verifican con PostgreSQL y los E2E reales. La configuración local no despliega migraciones ni aplicación en un proyecto remoto.
