# Prueba manual: alta de agencias desde plataforma

## Preparación

1. Supabase local debe estar iniciado. Ejecutá `npm run db:migrate` para aplicar la migración nueva; no hagas reset.
2. Usá las cuentas Auth de QA existentes: `qa-plataforma@example.test` para plataforma y `qa-a@example.test` para la denegación. Si faltan, crealas en Authentication → Users antes de ejecutar la preparación. No es necesario asignar membresías de agencia.
3. En SQL Editor local, ejecutá la preparación siguiente. No modifica perfiles existentes ni asignaciones preexistentes: si la cuenta ya tiene una asignación de plataforma, aborta. En ese caso podés usar su acceso actual, pero no ejecutes la limpieza de asignación indicada al final.

```sql
do $$
declare
  platform_user uuid;
begin
  select id into strict platform_user from auth.users
    where email = 'qa-plataforma@example.test';
  if exists (select 1 from public.platform_admins where user_id = platform_user) then
    raise exception 'Ya existe una asignación de plataforma. No se modificó: revisá su estado antes de continuar.';
  end if;
  if exists (select 1 from public.agencies where slug = 'qa-manual-alta-agencia') then
    raise exception 'El identificador QA ya está ocupado. No se modificaron registros.';
  end if;
  insert into public.profiles(id, display_name)
    values (platform_user, 'Plataforma QA') on conflict (id) do nothing;
  insert into public.platform_admins(user_id, is_active)
    values (platform_user, true);
end;
$$;
```

4. Ejecutá `npm run dev` y abrí `/login`. El usuario de QA usa su contraseña actual; no se crean ni cambian contraseñas con este SQL.

## Alta y persistencia

1. Ingresá como `qa-plataforma@example.test`. En plataforma elegí **Administrar agencias** y luego **Crear agencia**.
2. Enviá el formulario vacío: debe mostrar errores y enfocar el nombre.
3. Completá nombre `Agencia QA de alta`, identificador `qa-manual-alta-agencia` y cotización `0`: debe rechazarla. También rechaza negativos, notación exponencial y más de seis decimales.
4. Guardá con cotización `1000,123456`. Debe volver al listado y mostrar la agencia activa con el valor `1000.123456` (se permiten ceros finales según la precisión de PostgreSQL).
5. Recargá: la agencia debe persistir. El listado muestra hasta veinte registros por página y enlaces de paginación cuando correspondan.
6. Intentá crear otra agencia con el mismo identificador: debe informar que ya existe y conservar los valores del formulario, sin crear otro registro.

Podés comprobar el alta y su autor directamente, sin modificar datos:

```sql
select a.id, a.name, a.slug, a.ars_per_usd, a.is_active,
       e.actor_id, e.action, e.created_at
from public.agencies a
join public.audit_events e on e.agency_id = a.id
where a.slug = 'qa-manual-alta-agencia';
```

Debe existir una sola agencia y un solo evento `agency.created`. El actor corresponde a la cuenta de plataforma que realizó el alta. La aplicación utiliza la identidad verificada; no acepta un autor suministrado por el formulario.

## Permisos y estados

- Sin sesión, `/plataforma/agencias` y `/plataforma/agencias/nueva` llevan a login.
- Ingresando como `qa-a@example.test`, ambas rutas devuelven 404, incluso agregando `?role=platform_admin`. Si esa cuenta ya tiene plataforma asignada, elegí otra cuenta QA sin esa asignación para comprobar la denegación.
- El rol de superadministrador de una agencia no otorga administración de plataforma.
- Con plataforma, `?page=0`, `?page=abc` y `?page=1&page=2` muestran un error explícito de página inválida.
- Para comprobar revocación mientras el formulario está abierto, preparalo con el identificador QA **antes de guardar** y desactivá la asignación creada en esta preparación usando la consulta siguiente. Enviar debe dar error de permiso; recargar la ruta debe devolver 404. Reactivala después para terminar la prueba.

```sql
-- Ejecutar solo sobre la asignación QA creada en esta preparación.
update public.platform_admins set is_active = false
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');

-- Restaurar después de comprobar la denegación.
update public.platform_admins set is_active = true
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');
```

La agencia se crea sin usuarios asignados. Asignar responsables, invitar usuarios y editar/desactivar agencias no forman parte de esta entrega. Los fallos de consulta deben mostrar un error, no un listado vacío inventado.

## Limpieza acotada

Ejecutá esto únicamente si la preparación anterior terminó sin error y el slug estaba libre. Se borran solo el alta de esta prueba, su auditoría y la asignación temporal. Se conservan Auth y perfiles. No reutilices esta limpieza para agencias con datos de negocio: sus referencias bloquearán el borrado.

```sql
begin;
delete from public.audit_events
where agency_id = (select id from public.agencies where slug = 'qa-manual-alta-agencia')
  and action = 'agency.created'
  and actor_id = (select id from auth.users where email = 'qa-plataforma@example.test');
delete from public.agencies where slug = 'qa-manual-alta-agencia';
delete from public.platform_admins
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');
commit;
```

Si usaste una asignación de plataforma que ya existía, omití su `delete` y no cambies su estado como parte de la prueba. Si el alta no se realizó, no hay agencia ni auditoría que retirar.
