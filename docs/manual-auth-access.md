# Prueba manual de autenticación y accesos

Esta guía parte de la **carga SQL conjunta de los tres usuarios**, no de una carga por etapas. Si ya la ejecutaste, empezá por «Estado inicial esperado». El selector de U1 y la entrada directa de UP a plataforma son los resultados correctos desde el inicio.

## Preparación y carga SQL

1. Ejecutar `npm run db:start` si Supabase está detenido, `npm run db:migrate` y `npm run dev`.
2. Abrir [Supabase Studio local](http://127.0.0.1:54323) y [login local](http://localhost:3000/login). Si Next indica otro puerto, usarlo durante toda la prueba.
3. Los tres usuarios Auth deben existir con correo confirmado: `qa-a@example.test` (**U1**), `qa-b@example.test` (**U2**) y `qa-plataforma@example.test` (**UP**). Si ya están creados, no recrearlos.
4. Para preparar o restaurar los datos QA, ejecutar este SQL en SQL Editor local. Busca los UUID por esos correos ficticios, sin guardar UUID personales en el repositorio. Si falta una cuenta, la carga falla antes de escribir datos. Es equivalente a la query conjunta entregada en el chat.

```sql
begin;

do $$
declare
  user_a uuid;
  user_b uuid;
  platform_user uuid;
begin
  select id into strict user_a from auth.users
    where email = 'qa-a@example.test';
  select id into strict user_b from auth.users
    where email = 'qa-b@example.test';
  select id into strict platform_user from auth.users
    where email = 'qa-plataforma@example.test';

  insert into public.profiles (id, display_name) values
    (user_a, 'QA Usuario A'),
    (user_b, 'QA Usuario B'),
    (platform_user, 'QA Administrador de plataforma')
  on conflict (id) do nothing;

  insert into public.agencies
    (id, name, slug, is_active, ars_per_usd)
  values
    ('a1100000-0000-4000-8000-000000000001',
     'Agencia QA A', 'qa-manual-agencia-a', true, 1000),
    ('a1100000-0000-4000-8000-000000000002',
     'Agencia QA B', 'qa-manual-agencia-b', true, 1000)
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    is_active = excluded.is_active,
    ars_per_usd = excluded.ars_per_usd;

  insert into public.memberships
    (id, agency_id, user_id, role, is_active)
  values
    ('b1100000-0000-4000-8000-000000000001',
     'a1100000-0000-4000-8000-000000000001', user_a, 'admin', true),
    ('b1100000-0000-4000-8000-000000000002',
     'a1100000-0000-4000-8000-000000000002', user_a, 'seller', true),
    ('b1100000-0000-4000-8000-000000000003',
     'a1100000-0000-4000-8000-000000000002', user_b, 'seller', true)
  on conflict (agency_id, user_id) do update set
    role = excluded.role,
    is_active = excluded.is_active;

  insert into public.platform_admins (user_id, is_active)
  values (platform_user, true)
  on conflict (user_id) do update set is_active = excluded.is_active;
end;
$$;

commit;
```

La carga se puede repetir para restaurar los roles y estados QA después de cada escenario. Conserva los perfiles existentes y las cuentas Auth. Los permisos se asignan en `memberships` y `platform_admins`; editar metadata de Auth no concede acceso.

## Estado inicial esperado

| Cuenta                           | Datos cargados                     | Pantalla al ingresar                                                  |
| -------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| U1: `qa-a@example.test`          | Administrador en A y vendedor en B | `/panel`: «Elegí una agencia», con ambas opciones y sus roles         |
| U2: `qa-b@example.test`          | Vendedor en B                      | `/panel`: «Panel de agencia», Agencia QA B y «Vendedor»               |
| UP: `qa-plataforma@example.test` | Plataforma activa, sin membresías  | `/plataforma`: «Acceso de plataforma» y «Administrador de plataforma» |

U1 **no entra directamente en A** con esta carga, porque ya tiene dos membresías. UP **no comienza sin acceso**, porque la asignación de plataforma ya está activa. No hay que insertar otra vez esas asignaciones.

## Sesión, selección y aislamiento

| Acción                                                | Resultado esperado                                              |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Sin sesión, abrir `/panel`, `/cuenta` o `/plataforma` | Redirección a `/login`                                          |
| Enviar login vacío o correo inválido                  | Errores asociados a los campos                                  |
| Ingresar una contraseña incorrecta                    | Error genérico de credenciales; permanece en login              |
| Ingresar como U1                                      | Selector de A/B                                                 |
| Elegir A con U1                                       | Agencia QA A, correo de U1 y «Administrador»                    |
| Pulsar «Cambiar de agencia» y elegir B                | Agencia QA B y «Vendedor»                                       |
| Volver a `/panel` sin parámetros con U1               | Ofrece nuevamente las dos agencias; la selección vive en la URL |
| Abrir «Mi cuenta» y recargar                          | Conserva la sesión y muestra el correo propio                   |
| Abrir `/login` con sesión                             | Redirige al acceso correspondiente                              |
| Cerrar sesión y abrir `/panel`                        | Vuelve al login, sin datos de la sesión anterior                |

Ingresar como **U2** para probar enlaces manipulados:

| URL                                                                                              | Resultado esperado                        |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `/panel?agency=a1100000-0000-4000-8000-000000000002`                                             | Panel de B como vendedor                  |
| `/panel?agency=a1100000-0000-4000-8000-000000000001`                                             | «Acceso no disponible», sin detalles de A |
| `/panel?agency=invalid`                                                                          | «Acceso no disponible»                    |
| `/panel?agency=a1100000-0000-4000-8000-000000000002&agency=a1100000-0000-4000-8000-000000000001` | Denegación por selector duplicado         |
| `/panel?agency=a1100000-0000-4000-8000-000000000002&role=agency_superadmin`                      | Sigue siendo vendedor                     |
| `/plataforma` o `/plataforma?role=platform_admin`                                                | Página no encontrada (404)                |

## Cambio de rol y revocación de membresías

Con U1 en B, ejecutar este SQL y recargar esa página. Debe mostrar «Superadministrador de agencia» sin volver a iniciar sesión:

```sql
update public.memberships
set role = 'agency_superadmin'
where agency_id = 'a1100000-0000-4000-8000-000000000002'
  and user_id = (select id from auth.users where email = 'qa-a@example.test');
```

Para retirar a U1 el acceso a B:

```sql
update public.memberships
set is_active = false
where agency_id = 'a1100000-0000-4000-8000-000000000002'
  and user_id = (select id from auth.users where email = 'qa-a@example.test');
```

Recargar la URL seleccionada de B: «Acceso no disponible». Abrir `/panel` sin parámetros: ahora entra directamente en A, su única agencia habilitada.

Para comprobar «Sin acceso habilitado», desactivar también la membresía de A:

```sql
update public.memberships
set is_active = false
where agency_id = 'a1100000-0000-4000-8000-000000000001'
  and user_id = (select id from auth.users where email = 'qa-a@example.test');
```

Recargar `/panel` sin parámetros con U1: «Sin acceso habilitado», con cuenta y logout disponibles. Repetir la carga SQL inicial para restaurar sus dos membresías y roles.

## Agencia desactivada

Con los datos iniciales restaurados, ingresar como U1 y seleccionar B. Ejecutar:

```sql
update public.agencies
set is_active = false
where id = 'a1100000-0000-4000-8000-000000000002';
```

Recargar la URL seleccionada: «Acceso no disponible». Abrir `/panel` sin parámetros con U1: entra directamente en A. Ingresar como U2: «Sin acceso habilitado», porque su única agencia está desactivada. Repetir la carga inicial para restaurar B.

Los cambios se comprueban en la siguiente solicitud/recarga; no hay actualización en tiempo real de la pantalla ya abierta. Un error de conexión debe mostrarse como error/reintento, no como una lista vacía inventada.

## Plataforma

Con el estado inicial, UP ya entra en `/plataforma`; no necesita una membresía ni una nueva inserción. Para comprobar la revocación, ejecutar:

```sql
update public.platform_admins
set is_active = false
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');
```

Recargar `/plataforma`: 404. Abrir `/panel` con UP: «Sin acceso habilitado». La sesión sigue siendo válida, pero la asignación ya no está activa. Para restaurarla:

```sql
update public.platform_admins
set is_active = true
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');
```

La pantalla de plataforma muestra únicamente identidad/rol verificados. La gestión global de agencias y usuarios todavía no está implementada.

## Cambio de usuario y renovación de sesión

Con los datos iniciales restaurados, ingresar como U1 y abrir A. Cerrar sesión e ingresar como U2 en la misma ventana: debe abrir B como vendedor, sin contexto de U1. Abrir el enlace guardado de A debe negar acceso.

Para comprobar renovación real de sesión, esperar a que el token alcance su vencimiento (configuración local actual: una hora) y recargar. Recargar inmediatamente solo prueba persistencia. Las pruebas automatizadas ejercitan una renovación real sin esperar una hora.

## Limpieza opcional

Este SQL retira solo las tres membresías QA, la asignación de plataforma del usuario QA y las dos agencias de esta carga. Conserva perfiles y usuarios Auth. Si agregaste otras relaciones a esas agencias, la restricción de referencias impedirá borrarlas: no usar `CASCADE` ni reset para forzar la limpieza.

```sql
begin;

delete from public.memberships
where (
  agency_id = 'a1100000-0000-4000-8000-000000000001'
  and user_id = (select id from auth.users where email = 'qa-a@example.test')
) or (
  agency_id = 'a1100000-0000-4000-8000-000000000002'
  and user_id in (
    select id from auth.users
    where email in ('qa-a@example.test', 'qa-b@example.test')
  )
);

delete from public.platform_admins
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');

delete from public.agencies
where (id = 'a1100000-0000-4000-8000-000000000001' and slug = 'qa-manual-agencia-a')
   or (id = 'a1100000-0000-4000-8000-000000000002' and slug = 'qa-manual-agencia-b');

commit;
```

Comprobación técnica adicional: `npm run check`, `npm run db:test`, `npm run build` y `npm run test:e2e`. La guía comprueba el flujo visible; las pruebas reales verifican también restricciones y permisos.
