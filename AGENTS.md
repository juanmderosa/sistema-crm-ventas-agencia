# Project contract

## Product and scope

- Shared dealership product: one codebase, multiple isolated agencies, first pilot with one agency.
- Work in complete, reviewable features. Stage 0 is foundations, not a finished MVP.
- UI and user messages in Spanish; identifiers and code in English.
- Read docs/architecture.md and docs/testing.md before implementation. Track delivery truth in docs/status.md.

## Engineering rules

- TypeScript strict. No explicit any, ts-ignore, blanket lint disables, or assertions that hide invalid data.
- Validate untrusted inputs with Zod. Authorization belongs on the server and in PostgreSQL RLS, never only in navigation.
- Never expose privileged Supabase keys, log personal data, or trust client-supplied agency/role ownership.
- Organize by feature. Keep UI, domain rules and data access separate; avoid speculative generic repositories.
- Server Components by default. Add client boundaries only for interaction.
- TanStack Query owns remote panel state; React Hook Form owns forms; URL owns shareable filters; React owns local interaction.
- Include agency and user in private query keys. Clear private cache on session/context changes. Never share a QueryClient between server requests.
- Use migrations for database changes. Generate database types from a running migrated Supabase instance; never label hand-written types as generated.
- No customer-specific forks or agency-name conditionals. Use configuration and explicit optional modules.
- Use exact dependencies and commit the lockfile. Justify dependency additions and architecture changes.
- No silent errors, fabricated success, nonfunctional controls presented as working, or tests removed just to obtain a green build.

## Verification and delivery

- Tests first for permissions, isolation and transactional business rules; risk-based testing elsewhere.
- Use real local Supabase for RLS, Storage and concurrency verification; mocks cannot certify authorization.
- Run format check, lint, typecheck, tests and build. Run relevant database and E2E tests when introduced.
- Explain skipped/blocked checks. A build does not prove Cloudflare runtime or production readiness.
- No production deployments, paid services or customer data in fixtures without the appropriate task scope.
- Update docs/status.md with verified outcomes and remaining work each delivery.
