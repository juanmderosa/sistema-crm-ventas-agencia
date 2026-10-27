# Estado de entrega

## CI por alcance (2026-10-27)

En `codex/ci-workflow`: workflow limitado a PR hacia `develop`/`main` y ejecución manual; cancelación de corridas anteriores del mismo PR; check `application` conservado. Los cambios exclusivamente Markdown raíz o `docs/**/*.md` verifican formato sin `npm ci`, Chromium ni builds. Cualquier otro archivo activa la suite completa. La selección usa el diff completo del PR, incluyendo eliminaciones y renombres, con pruebas de regresión sin dependencias adicionales.

Verificación local: 8 pruebas del selector, YAML parseado, formato, lint, TypeScript, 2 pruebas de aplicación y build Next.js aprobados. El build requirió salir del aislamiento tras un error EPERM en `.next`. No se repitieron navegador ni empaquetado Cloudflare local porque no cambió la aplicación ni sus dependencias; se conservan ambos controles para PR de código. No se ejecutaron ni cancelaron Actions remotas; las corridas ya iniciadas conservan la configuración anterior. Esta modificación del workflow requiere una corrida completa; la mejora documental se observa en PR posteriores.

## Reglas de Git (2026-10-27)

Guardadas en `AGENTS.md`: el usuario opera Git; el asistente entrega título y descripción de commit. Flujo `codex/<funcionalidad>` → `develop` → `main`, con carga inicial de fundaciones directamente a `main`. No se ejecutaron operaciones de escritura de Git en esta entrega. Cambio solo documental; verificación de formato, sin repetir pruebas de aplicación.

## Etapa 0 — fundaciones

Implementado: contrato de código, arquitectura/ADRs, mapa de pantallas, matriz de permisos, modelo lógico, estrategia de pruebas, aplicación base Next.js, TypeScript estricto, Tailwind, configuración shadcn, claves de caché privadas, Vitest, Playwright, pipeline GitHub Actions y configuración OpenNext/Cloudflare. Supabase CLI inicializado con registro público deshabilitado.

No implementado todavía: autenticación de aplicación, migraciones de negocio, políticas RLS, APIs, inventario, sitio comercial, consultas, CRM y estadísticas. No hay datos ficticios presentados como información real ni rutas privadas simuladas.

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

Etapa 1: migración de agencias/perfiles/membresías/roles de plataforma, pruebas reales de aislamiento con dos agencias, login y administración inicial. Requiere Docker Linux activo para poder aceptar la seguridad del backend. No usar mocks como sustituto de esa verificación.

## Antes del piloto

Completar las etapas funcionales; ejecutar integración, concurrencia y RLS; revisar logs y recuperación de datos; verificar Worker y cuotas reales; configurar cuentas y secretos de despliegue. Los artefactos de build locales no constituyen un piloto desplegado.
