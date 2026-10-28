# Prueba manual: superadministrador inicial

## Preparación local

Ejecutá `npm run db:migrate` (sin reset) y luego `npm run dev`. Usá las cuentas Auth de QA existentes: `qa-plataforma@example.test` y `qa-a@example.test`. El flujo elige usuarios con perfil en `public.profiles`; no crea cuentas ni envía invitaciones. Si una cuenta Auth todavía no tiene perfil, no aparece en el selector.

Este SQL prepara una agencia vacía y una asignación temporal de plataforma. Conserva los perfiles existentes y aborta sin cambios si la agencia o la asignación de plataforma ya existían. En ese caso, revisá esos registros: podés usar una cuenta de plataforma ya habilitada y una agencia vacía creada desde la aplicación, pero la limpieza de abajo corresponde únicamente a esta preparación completa.

```sql
do $$
declare
  platform_user uuid;
  target_user uuid;
begin
  select id into strict platform_user from auth.users where email='qa-plataforma@example.test';
  select id into strict target_user from auth.users where email='qa-a@example.test';
  if platform_user=target_user then raise exception 'Las identidades deben ser diferentes'; end if;
  if exists(select 1 from public.platform_admins where user_id=platform_user) then
    raise exception 'La asignación de plataforma ya existe. No se modificó ningún registro.';
  end if;
  if exists(select 1 from public.agencies where id='e5500000-0000-4000-8000-000000000001' or slug='qa-manual-superadmin') then
    raise exception 'La agencia QA ya existe. No se modificó ningún registro.';
  end if;
  insert into public.profiles(id,display_name) values (platform_user,'Plataforma QA'),(target_user,'Responsable QA') on conflict(id) do nothing;
  insert into public.platform_admins(user_id) values(platform_user);
  insert into public.agencies(id,name,slug,ars_per_usd) values('e5500000-0000-4000-8000-000000000001','Agencia QA responsable','qa-manual-superadmin',1000);
end;
$$;
```

## Asignación y acceso

1. Ingresá como plataforma, abrí **Administrar agencias** y buscá **Agencia QA responsable**. Pulsá **Superadministrador**.
2. Enviá sin usuario: debe mostrar el error, enfocar el selector y conservar el formulario.
3. Buscá el perfil de `qa-a@example.test` por su nombre e ID. El selector muestra veinte usuarios por página; **Más usuarios** y **Usuarios anteriores** recorren las páginas. Si el perfil ya existía, conserva su nombre anterior. Podés consultar el ID sin modificarlo:

```sql
select p.id,p.display_name from public.profiles p
join auth.users u on u.id=p.id where u.email='qa-a@example.test';
```

4. Elegí ese usuario y pulsá **Asignar superadministrador**. Debe aparecer su nombre/ID con estado **Activo**, sin un botón para volver a asignar. Recargá: debe persistir.
5. En otra ventana, ingresá como `qa-a@example.test`. `/panel` debe permitir entrar a la agencia con rol **Superadministrador de agencia**. Si tiene otras agencias, elegí esta en el selector. Si la ventana estaba abierta, recargá para volver a resolver permisos.
6. Ese nuevo superadministrador no puede entrar a `/plataforma`: su permiso pertenece solo a la agencia.

La consulta siguiente debe devolver una membresía activa con el rol correcto y un evento que identifica tanto al autor como al usuario asignado:

```sql
select m.user_id,m.role,m.is_active,e.actor_id,e.target_user_id,e.action
from public.memberships m
join public.audit_events e on e.agency_id=m.agency_id and e.target_user_id=m.user_id
where m.agency_id='e5500000-0000-4000-8000-000000000001'
  and e.action='membership.superadmin_assigned';
```

## Casos negativos

- Sin sesión, la ruta `/plataforma/agencias/e5500000-0000-4000-8000-000000000001/superadministrador` lleva al login. Con una cuenta sin plataforma devuelve 404, incluso con `?role=platform_admin`.
- Un ID de agencia inválido o inexistente devuelve 404; `?page=0` o `?page=1&page=2` muestra un error de página de usuarios.
- Una agencia inactiva no permite asignar. Un usuario que ya pertenece a esa agencia no es promovido ni reactivado: la operación devuelve un error y conserva su membresía.
- Una asignación previa de superadministrador, incluso inactiva, impide esta operación inicial. No sirve para reemplazar responsables ni cambiar roles.
- Abrí el formulario en dos ventanas antes de guardar y elegí dos usuarios diferentes. Solo una asignación debe prosperar; la otra muestra conflicto. Recargar ambas debe mostrar el mismo responsable y existir un solo evento.
- Para revocación, antes de guardar desactivá únicamente la asignación QA creada en la preparación; enviar debe fallar sin crear membresía. Restaurala antes de continuar:

```sql
update public.platform_admins set is_active=false
where user_id=(select id from auth.users where email='qa-plataforma@example.test');
-- Después de comprobar el rechazo:
update public.platform_admins set is_active=true
where user_id=(select id from auth.users where email='qa-plataforma@example.test');
```

## Limpieza

Ejecutá únicamente si la preparación terminó sin error y usaste su agencia/usuarios. Se conservan Auth y perfiles, además de cualquier membresía en otras agencias. Si agregaste otras relaciones a la agencia QA, el borrado puede ser rechazado por las claves foráneas; no uses cascade ni limpieza global.

```sql
begin;
with removed_events as (
  delete from public.audit_events
  where agency_id='e5500000-0000-4000-8000-000000000001'
    and action='membership.superadmin_assigned'
    and actor_id=(select id from auth.users where email='qa-plataforma@example.test')
  returning target_user_id
)
delete from public.memberships
where agency_id='e5500000-0000-4000-8000-000000000001'
  and role='agency_superadmin'
  and user_id in (select target_user_id from removed_events);
delete from public.agencies where id='e5500000-0000-4000-8000-000000000001' and slug='qa-manual-superadmin';
delete from public.platform_admins where user_id=(select id from auth.users where email='qa-plataforma@example.test');
commit;
```

Si usaste una asignación de plataforma o una agencia preexistente, esta limpieza no corresponde: no borres ni desactives esos registros.
