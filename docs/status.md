# Estado de entrega

## Etapa 1 — incremento 1: esquema y aislamiento (2026-10-27)

En `codex/agencies-roles-schema`: migración mínima de `agencies`, `profiles`, `memberships` y `platform_admins`, restricciones y RLS de lectura. Membresías múltiples con roles independientes, administración de plataforma separada y revocación por estado activo. Ningún cliente tiene escrituras directas, tampoco los administradores. Sin login, gestión de usuarios, auditoría de cambios de rol, pantallas ni tipos generados.

Aplicada únicamente a Supabase local mediante `supabase migration up --local`, sin reset ni eliminación de datos. Docker Linux/PostgreSQL 17.11 disponibles. pgTAP falló primero por ausencia del esquema y luego pasó sus 105 comprobaciones reales; fixtures sintéticos dentro de una transacción revertida. Un caso de FK se corrigió para no disparar antes la unicidad de un usuario multiagencia. El contenedor de logs `vector` se observó reiniciándose durante la exploración; la aceptación verificada aquí corresponde a PostgreSQL/RLS, no a toda la infraestructura.

Verificación: `npm run db:test` (105 comprobaciones), `npm run check` (formato, lint, TypeScript y 2 pruebas unitarias) y `npm run build` aprobados. Se normalizaron finales CRLF a LF de archivos existentes para satisfacer Prettier, sin cambios de contenido ajenos al alcance. El build necesitó ejecutarse fuera del aislamiento después de EPERM al crear un directorio de `.next`; se retiró su cambio automático en `next-env.d.ts`. No se repitieron E2E, empaquetado OpenNext ni runtime Worker porque este incremento no modifica aplicación, dependencias ni integración de datos; no se certifica producción ni autenticación HTTP con pgTAP.

Pendiente de revisión del usuario. Siguiente incremento, después del punto de commit: tipos generados desde la base migrada y pruebas de base de datos en CI. No considerar la tarea completa ni lista para integración hasta ese incremento. No se modificaron dependencias, override de glob ni configuración de OpenNext/Cloudflare.

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

React Hook Form, SDK Supabase, Testing Library y Recharts se incorporarán en sus funcionalidades; no se presentan como integrados aún. Los tipos de base de datos se generarán después de aplicar migraciones, nunca manualmente.

## Próxima entrega

Completar el incremento 2 de esta tarea: tipos generados y CI de base de datos. Login y administración inicial quedan como tareas posteriores, fuera del alcance aprobado del esquema y aislamiento. Docker Linux está disponible; no usar mocks como sustituto de la verificación de seguridad.

## Antes del piloto

Completar las etapas funcionales; ejecutar integración, concurrencia y RLS; revisar logs y recuperación de datos; verificar Worker y cuotas reales; configurar cuentas y secretos de despliegue. Los artefactos de build locales no constituyen un piloto desplegado.
