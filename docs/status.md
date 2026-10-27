# Estado de entrega

## Corrección — formularios bloqueados en desarrollo (2026-10-27)

Reproducido en el servidor de desarrollo real: `localhost:3000` hidrataba correctamente, pero `127.0.0.1:3000` rechazaba la conexión WebSocket de HMR. React no terminaba de hidratar y el fieldset compartido permanecía deshabilitado. Se agregó únicamente `127.0.0.1` a `allowedDevOrigins` en `next.config.ts`; se conserva la protección de hidratación y no se amplía la lista a dominios arbitrarios. Los E2E previos usaban `next start`, por eso no cubrían este bloqueo exclusivo de `next dev`.

Verificado con Chromium en el servidor `npm run dev`: foco mediante clic, escritura y validaciones de ambos formularios de recuperación en `localhost` y `127.0.0.1`, con anchos de escritorio/celular, sin errores de JavaScript ni de WebSocket. No se enviaron correos ni se modificaron cuentas durante esa comprobación. Formato, lint, TypeScript, 11 pruebas unitarias y build Next.js aprobados. Se retiró el cambio automático de next-env.d.ts. Guía manual y contrato de pruebas actualizados con la comprobación de desarrollo. Sin cambios en Auth/RLS, dependencias o formularios; no corresponde repetir pgTAP ni los flujos completos de correo/Worker por esta configuración exclusiva de desarrollo. No se ejecutaron operaciones de escritura Git.

## Autenticación — incremento 3: recuperación de contraseña (2026-10-27)

En `codex/auth-password-recovery`: enlace desde login, solicitud con respuesta genérica para cuentas existentes/ausentes, correo local personalizado y formulario de contraseña/confirmación con mínimo de ocho caracteres. Formularios e inputs compartidos, handlers nombrados y adaptador Auth separado. Sin tablas, migraciones, dependencias nuevas ni cambios de lockfile.

El enlace funciona en otro navegador: GET no lo consume; al guardar se verifica específicamente como recuperación en Auth, se actualiza únicamente la identidad de ese token y se cierra su sesión temporal en memoria. No se instala una sesión de recuperación en el navegador. Una sesión común no autoriza el cambio. Al finalizar se cierra también la sesión del navegador y se vuelve al login. Enlaces incompletos, alterados, duplicados o utilizados fallan explícitamente. Origen de correo definido por `APP_ORIGIN`, validado y separado de Host/`next` enviados por el cliente; respuestas sin caché y sin referente.

Aplicada configuración de Auth únicamente a Supabase local mediante reinicio conservando volúmenes: plantilla de correo y mínimo de ocho caracteres. Configurado el origen local en el archivo de entorno ignorado, sin imprimir claves. La [guía manual](manual-password-recovery.md) utiliza una cuenta Auth de prueba existente: no necesita SQL ni filas de negocio y explica la limpieza, los casos negativos y la configuración remota pendiente.

Verificado: formato, lint, TypeScript, 11 pruebas unitarias, 8 del selector CI, 105 comprobaciones pgTAP, comparación de tipos, build Next.js y 36 casos E2E escritorio/celular con Auth y Mailpit reales. La corrida completa local usó dos workers para limitar contención; no se aumentaron timeouts ni se eliminaron casos. Se corrigió una carrera de la prueba esperando el encabezado de recuperación antes de llenar un correo que también existe en la pantalla de login. Se revisó captura móvil sin desbordamiento.

OpenNext y Wrangler dry-run aprobados: 7226.55 KiB / gzip 1481.17 KiB. Worker local: seis casos de recuperación aprobados en escritorio/celular; se detuvo después. Se conservan las advertencias de compatibilidad parcial con Windows y soporte experimental de Node.js Proxy en OpenNext. No se desplegó ni se operó Git remoto. El vencimiento real tras una hora queda como comprobación manual documentada: las pruebas automáticas de tokens alterados/reutilizados no lo certifican. SMTP remoto, plantilla y URLs del proyecto remoto y GitHub Actions requieren verificación antes de integrar/desplegar.

Se normalizaron finales de línea para satisfacer Prettier, sin cambios de contenido ajenos al alcance, y se retiró el cambio automático de `next-env.d.ts`. No se ejecutaron operaciones de escritura Git. Próximo paso: validación manual del usuario y commit del incremento antes de continuar con otra funcionalidad.

## Autenticación — incremento 2: contexto de acceso (2026-10-27)

En `codex/auth-membership-access`, con el incremento 1 versionado por el usuario en `4c96f85`: login deriva a `/panel`; una membresía activa en una agencia activa abre el contexto, varias ofrecen un selector, ninguna muestra «Sin acceso habilitado». Selección mediante URL `?agency=<uuid>` con validación Zod y revalidación contra las asignaciones actuales en cada solicitud. Se muestran solamente usuario/agencia/rol reales. Entradas inválidas, duplicadas, ajenas o revocadas muestran una denegación genérica sin datos de la agencia.

`/plataforma` requiere una asignación activa independiente y permite comprobar identidad/rol de plataforma; acceso autenticado sin esa asignación devuelve 404. No implementa todavía administración global de agencias. La sesión se verifica en el servidor y la consulta bajo RLS filtra explícitamente al usuario actual; roles o pertenencias suministrados por el cliente no autorizan acceso. Cambios de rol y desactivaciones surten efecto en la siguiente solicitud. Proxy, cookies y headers de caché cubren las nuevas rutas. Cambio de agencia/login/logout mediante navegación completa; no hay QueryClient privado ni caché remoto interactivo aún.

Pruebas primero: fallaron el módulo de selección ausente y la entrada anónima a `/panel` antes de implementar. Formato, lint, TypeScript, 7 pruebas unitarias, build Next.js, 105 comprobaciones pgTAP, comparación de tipos y 30 E2E completos aprobados después del refactor solicitado. Se verificaron foco y asociación accesible de errores en los inputs compartidos. Un fixture de inserción por lote se corrigió para enviar estados activos explícitos en ambos registros. Los conteos de plataforma en pgTAP se limitan a sus IDs sintéticos para convivir con datos manuales locales, conservando las 105 comprobaciones. Fixtures compartidos entre pruebas de sesión y acceso, con usuarios/agencias/membresías sintéticos y limpieza limitada a sus IDs. Sin cambios de dependencias, migraciones, reset, datos de clientes ni operaciones de escritura Git en este incremento.

Revisión solicitada por el usuario: consultas centralizadas en `server/queries.ts`, contexto separado de construcción/validación de queries, wrappers compartidos `Form`/`Input` y handlers nombrados de login/logout fuera del JSX. Reglas asentadas en `AGENTS.md`. Guía manual completa en `docs/manual-auth-access.md`. Capturas de login y selector revisadas. OpenNext build y Wrangler dry-run del código refactorizado aprobados (7172.18 KiB / gzip 1476.71 KiB), sin desplegar. Se conservan las advertencias documentadas de Windows, Proxy experimental y código de validación empaquetado.

Preferencia de prueba manual guardada en `AGENTS.md`: entregar SQL de carga y limpieza acotada directamente cuando hagan falta fixtures, sin exigir carga por Table Editor ni ejecutar las consultas sin pedido. Los UUID de usuarios de prueba suministrados en el chat no se incorporan a archivos versionados. Cambio documental verificado con Prettier; sin repetir pruebas de aplicación ni modificar datos para registrar esta regla.

Guía manual alineada con la carga SQL conjunta: U1 comienza con dos membresías y selector, U2 entra en B y UP ya tiene plataforma habilitada. Se corrigieron expectativas que todavía describían una preparación por etapas. La guía incluye SQL de carga/restauración, cambios de estado y limpieza, usando los correos ficticios para resolver identidades sin versionar sus UUID. Las capturas aportadas por el usuario coinciden con ese estado inicial. Cambio solo documental: formato verificado; no se ejecutaron consultas ni se repitieron pruebas de aplicación.

Worker local: la primera corrida detectó navegaciones lentas y, al repetirla con menos concurrencia, un clic de logout previo a hidratación que no enviaba ninguna solicitud (confirmado en la traza). Se corrigió deshabilitando el fieldset compartido y el logout hasta que los handlers estén disponibles. El modo Worker se limita a dos workers para reducir contención del emulador local, sin aumentar timeouts ni retirar comprobaciones. Después de la corrección aprobaron nuevamente los 30 E2E completos sobre Next y los 12 casos de acceso sobre Worker local. El resultado local no certifica estabilidad/rendimiento de producción ni sustituye CI remoto.

Pendiente de revisión y verificación remota del workflow antes de integrar. El trabajo funcional posterior (recuperación de contraseña, invitaciones, alta/gestión de usuarios y agencias, inventario/CRM) queda fuera de esta tarea.

## Autenticación — incremento 1: login y sesión (2026-10-27)

En `codex/auth-membership-access`: `/login` con React Hook Form/Zod, Server Actions de login/logout y `/cuenta` con validación de identidad en Auth desde el servidor. Inicio/cierre de sesión por cookies HttpOnly, SameSite=Lax; Secure en configuración HTTPS de producción. Proxy de Next.js renueva cookies antes del render y conserva headers para evitar caché de respuestas privadas. Navegación completa tras login/logout para descartar memoria cliente. No existe todavía QueryClient privado ni acceso al panel por membresías.

Agregados con versiones exactas y lockfile: `@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7, `react-hook-form` 7.91.0, `@hookform/resolvers` 6.0.1 y `server-only` 0.0.1. Justificación: SDK/sesiones SSR, formulario validado y barrera de imports de servidor. Instalación reportó 0 vulnerabilidades; se conservaron los avisos existentes de scripts de instalación. Sin actualización de OpenNext, override de glob ni otras dependencias directas.

Se corrigió la configuración pública de `.env.local` (no versionada): contenía una conexión PostgreSQL en lugar de la URL HTTP de API. La aplicación valida URL/clave pública y lee la configuración al ejecutar, evitando fijar un entorno dentro del build del servidor. El proveedor email local estaba deshabilitado; se habilitó en `auth.email` conservando `auth.enable_signup = false`. Supabase se reinició conservando volúmenes, sin reset ni borrado de datos existentes.

Pruebas primero: fallaron la validación por ausencia del módulo y el acceso anónimo por ausencia de la ruta protegida. Después aprobaron formato, lint, TypeScript, 4 pruebas unitarias, 8 pruebas del selector CI, 18 E2E con Auth real en escritorio/móvil, 105 comprobaciones pgTAP, comparación de tipos y build Next.js. E2E verifica credenciales, persistencia, logout, renovación real de cookies, cookie falsificada y rechazo del registro público. Fixtures Auth/perfiles sintéticos con limpieza exclusiva por ID; credenciales locales de prueba solo en memoria del proceso de tests. Capturas del login vacío revisadas en escritorio/móvil.

OpenNext build y Wrangler dry-run aprobados, sin despliegue (7091.62 KiB / gzip 1460.92 KiB). Los mismos 18 E2E también aprobaron contra Worker local mediante `test:e2e:worker`; se documentó su reproducción manual. Se mantiene la advertencia del adaptador sobre Windows y aparece soporte experimental de Node.js middleware/Proxy en Cloudflare, no mantenido oficialmente por OpenNext: el resultado local no certifica estabilidad de producción. El empaquetador también emitió un aviso sobre `??` redundante en código de validación empaquetado; no se modificaron dependencias para resolverlo. CI conserva E2E sobre Next y empaquetado Cloudflare, sin ejecutar todavía E2E sobre Worker. Se normalizaron finales de línea existentes para Prettier sin cambios de contenido ajenos al alcance y se retiró el cambio automático de `next-env.d.ts`.

Punto de revisión/commit del incremento 1. Después corresponde implementar el contexto de acceso por membresías: una agencia, selección entre varias, ausencia de acceso y entrada mínima de plataforma. Recuperación de contraseña, registro, invitaciones y gestión de usuarios quedan fuera de esta tarea. No se realizaron operaciones de escritura Git ni despliegues; CI remoto de esta entrega pendiente de ejecución por el usuario.

## Etapa 1 — incremento 2: tipos y CI de base de datos (2026-10-27)

Generado `src/lib/supabase/database.types.ts` desde el esquema público de Supabase local migrado, con el CLI fijado en dependencias y formato Prettier. Nuevos comandos `db:migrate`, `db:types` y `db:types:check`; la comprobación no modifica archivos y falla si faltan, difieren o no se pueden generar. Los tipos describen estructura, no autorizan operaciones ni reemplazan RLS y validaciones.

El camino completo del check `application` ahora inicia Supabase aislado en el runner Linux, aplica migraciones, ejecuta pgTAP y comprueba tipos. Los PR solo documentales conservan su camino liviano. El límite del job pasa de 20 a 35 minutos para descargar/iniciar contenedores. No se imprimen ni suben los logs de inicio que pueden contener claves locales; no se usan conexiones ni secretos de producción. Sin nuevas dependencias, cambios de lockfile, reset local ni operaciones de escritura Git.

Verificado localmente: no había migraciones pendientes; 105 comprobaciones pgTAP aprobadas; generación y comparación de tipos aprobadas. Una diferencia temporal en el archivo fue rechazada con salida 1 y se restauró antes de verificar la coincidencia. YAML parseado correctamente. También aprobaron `npm run check` (formato, lint, TypeScript, 2 pruebas unitarias), 8 pruebas del selector CI, build Next.js, 4 pruebas E2E, build OpenNext y Wrangler dry-run (4503.01 KiB / gzip 939.04 KiB), sin despliegue. Se retiró el cambio automático de `next-env.d.ts`. Se conserva la advertencia de compatibilidad parcial de OpenNext con Windows; no se repitió ejecución de Worker local ni se certifica producción. GitHub Actions remoto todavía no ejecutado para este incremento: su aprobación en Linux sigue siendo requisito antes de integrar.

## Etapa 1 — incremento 1: esquema y aislamiento (2026-10-27)

En `codex/agencies-roles-schema`: migración mínima de `agencies`, `profiles`, `memberships` y `platform_admins`, restricciones y RLS de lectura. Membresías múltiples con roles independientes, administración de plataforma separada y revocación por estado activo. Ningún cliente tiene escrituras directas, tampoco los administradores. Sin login, gestión de usuarios, auditoría de cambios de rol, pantallas ni tipos generados.

Aplicada únicamente a Supabase local mediante `supabase migration up --local`, sin reset ni eliminación de datos. Docker Linux/PostgreSQL 17.11 disponibles. pgTAP falló primero por ausencia del esquema y luego pasó sus 105 comprobaciones reales; fixtures sintéticos dentro de una transacción revertida. Un caso de FK se corrigió para no disparar antes la unicidad de un usuario multiagencia. El contenedor de logs `vector` se observó reiniciándose durante la exploración; la aceptación verificada aquí corresponde a PostgreSQL/RLS, no a toda la infraestructura.

Verificación: `npm run db:test` (105 comprobaciones), `npm run check` (formato, lint, TypeScript y 2 pruebas unitarias) y `npm run build` aprobados. Se normalizaron finales CRLF a LF de archivos existentes para satisfacer Prettier, sin cambios de contenido ajenos al alcance. El build necesitó ejecutarse fuera del aislamiento después de EPERM al crear un directorio de `.next`; se retiró su cambio automático en `next-env.d.ts`. No se repitieron E2E, empaquetado OpenNext ni runtime Worker porque este incremento no modifica aplicación, dependencias ni integración de datos; no se certifica producción ni autenticación HTTP con pgTAP.

Incremento 1 versionado por el usuario antes de autorizar el incremento 2 descrito arriba. No se modificaron dependencias, override de glob ni configuración de OpenNext/Cloudflare.

## CI por alcance (2026-10-27)

En `codex/ci-workflow`: workflow limitado a PR hacia `develop`/`main` y ejecución manual; cancelación de corridas anteriores del mismo PR; check `application` conservado. Los cambios exclusivamente Markdown raíz o `docs/**/*.md` verifican formato sin `npm ci`, Chromium ni builds. Cualquier otro archivo activa la suite completa. La selección usa el diff completo del PR, incluyendo eliminaciones y renombres, con pruebas de regresión sin dependencias adicionales.

Verificación local: 8 pruebas del selector, YAML parseado, formato, lint, TypeScript, 2 pruebas de aplicación y build Next.js aprobados. El build requirió salir del aislamiento tras un error EPERM en `.next`. No se repitieron navegador ni empaquetado Cloudflare local porque no cambió la aplicación ni sus dependencias; se conservan ambos controles para PR de código. No se ejecutaron ni cancelaron Actions remotas; las corridas ya iniciadas conservan la configuración anterior. Esta modificación del workflow requiere una corrida completa; la mejora documental se observa en PR posteriores.

## Reglas de Git (2026-10-27)

Guardadas en `AGENTS.md`: el usuario opera Git; el asistente entrega título y descripción de commit. Flujo `codex/<funcionalidad>` → `develop` → `main`, con carga inicial de fundaciones directamente a `main`. No se ejecutaron operaciones de escritura de Git en esta entrega. Cambio solo documental; verificación de formato, sin repetir pruebas de aplicación.

## Etapa 0 — fundaciones

Implementado: contrato de código, arquitectura/ADRs, mapa de pantallas, matriz de permisos, modelo lógico, estrategia de pruebas, aplicación base Next.js, TypeScript estricto, Tailwind, configuración shadcn, claves de caché privadas, Vitest, Playwright, pipeline GitHub Actions y configuración OpenNext/Cloudflare. Supabase CLI inicializado con registro público deshabilitado.

Al cierre de etapa 0 no estaban implementados autenticación de aplicación, migraciones de negocio, políticas RLS, APIs, inventario, sitio comercial, consultas, CRM ni estadísticas. El avance posterior de esquema/RLS figura arriba. No hay datos ficticios presentados como información real ni rutas privadas simuladas.

## Evidencia (2026-10-26)

- Formato, ESLint, TypeScript y 2 pruebas unitarias: pasaron, incluida la repetición tras los ajustes finales.
- Build Next.js con Webpack: pasó. Turbopack falló al iniciar el proceso de CSS en este entorno Windows, incluso fuera del sandbox; se seleccionó Webpack para dev/build.
- Auditoría npm tras override transitivo: 0 vulnerabilidades reportadas.
- Playwright: 4 casos pasaron (escritorio y celular, contenido, ancho y acceso por teclado).
- OpenNext: build completado. Wrangler dry-run: completado sin publicar, 4502.67 KiB sin comprimir / 938.91 KiB gzip. El tamaño corresponde únicamente a la base actual.
- Worker local: respondió HTTP 200 y entregó el contenido esperado en localhost:8787. El adaptador advierte compatibilidad incompleta con Windows; el pipeline prepara la comprobación adicional en Linux.
- Supabase real: no ejecutado; Docker Desktop instalado pero motor Linux detenido.
- GitHub Actions: preparado, no ejecutado remotamente. No se creó remoto ni se publicó.

## Decisiones de herramientas

OpenNext 1.20.13 incorpora @node-minify/core con glob 10.3.3 vulnerable (GHSA-5j98-mcp5-4vw2). Se fija únicamente ese glob a 10.5.0 mediante override; no se ejecutó audit fix --force. Reexaminar el override al actualizar OpenNext. El aviso de deprecación de glob sigue siendo distinto del resultado de auditoría.

React Hook Form y SDK Supabase se incorporaron con autenticación (ver entrega arriba); Testing Library y Recharts siguen pendientes de sus funcionalidades. Los tipos de base de datos se generaron después de aplicar migraciones, nunca manualmente.

## Próxima entrega

Revisar/versionar los incrementos de autenticación y contexto de acceso; verificar la corrida remota completa antes de integrar. Administración inicial queda como tarea posterior. Docker Linux está disponible; no usar mocks como sustituto de la verificación de seguridad.

## Antes del piloto

Completar las etapas funcionales; ejecutar integración, concurrencia y RLS; revisar logs y recuperación de datos; verificar Worker y cuotas reales; configurar cuentas y secretos de despliegue. Los artefactos de build locales no constituyen un piloto desplegado.
