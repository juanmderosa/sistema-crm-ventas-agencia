# Plataforma para concesionarias

MVP multiagencia, un solo producto y una identidad configurable por agencia. **Entrega actual: etapa 0, fundaciones. No es todavía un sistema comercial operativo.**

## Requisitos

Node.js 22.14+ o 24, npm y Docker Desktop con motor Linux para Supabase. No se necesita una cuenta de nube para ejecutar la pantalla inicial.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. La pantalla inicial muestra honestamente el estado del proyecto; no simula un login ni datos comerciales.

## Controles

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run cf:build
npm run cf:dry-run
```

`cf:dry-run` empaqueta sin publicar. `cf:preview` ejecuta el Worker local una vez construido. Un build exitoso no confirma cuotas gratuitas ni despliegue real.

## Backend local

Con Docker Desktop iniciado:

```sh
npm run db:start
```

Las migraciones, RLS y pruebas SQL se incorporan en la etapa 1. No ejecutar `db:test` como evidencia de seguridad hasta que existan esos casos. Copiar `.env.example` a `.env.local` al conectar Supabase; completar la URL y clave pública que informa el entorno local. No compartir claves privadas por chat ni incorporarlas al repositorio.

## Documentos

- [Reglas del proyecto](AGENTS.md)
- [Arquitectura y decisiones](docs/architecture.md)
- [Pantallas y permisos](docs/screens-and-permissions.md)
- [Modelo lógico inicial](docs/data-model.md)
- [Pruebas y aceptación](docs/testing.md)
- [Estado y próximos pasos](docs/status.md)

El pipeline preparado requiere alojar el repositorio en GitHub para ejecutarse remotamente. No se ha creado un repositorio remoto ni desplegado la aplicación.
