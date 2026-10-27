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

- Break features into small, independently verifiable tasks before implementation. Define each task's scope, acceptance criteria and applicable checks.
- Deliver one coherent increment at a time, with an opportunity for the user to commit it before proceeding to the next increment. Prefer several focused commits over one large accumulated change; do not chase an arbitrary commit count.
- Keep pull requests small and focused too. Several commits do not make an oversized PR reviewable; split large features into safe, incremental PRs.
- Avoid unrelated refactors or dependency upgrades inside a feature task. If scope grows materially, propose a separate task before expanding the change.
- Each increment must preserve a working baseline and pass its applicable checks. Add meaningful tests according to risk; documentation-only changes require document checks rather than application tests.
- Tests first for permissions, isolation and transactional business rules; risk-based testing elsewhere.
- Use real local Supabase for RLS, Storage and concurrency verification; mocks cannot certify authorization.
- Run format check, lint, typecheck, tests and build. Run relevant database and E2E tests when introduced.
- Explain skipped/blocked checks. A build does not prove Cloudflare runtime or production readiness.
- No production deployments, paid services or customer data in fixtures without the appropriate task scope.
- Update docs/status.md with verified outcomes and remaining work each delivery.

## Git workflow

- The user manages Git operations, remote connections and pushes. Unless explicitly authorized for a specific action, do not stage, commit, create/switch/delete branches, merge, rebase, tag or push. Read-only Git inspection is allowed.
- For every delivery with file changes, provide a suggested commit title and description in Spanish; do not execute the commit.
- `main` contains approved production releases. The initial foundations upload is the agreed exception that goes directly to `main`.
- `develop` is the integration and pre-production branch, initially created from `main` by the user.
- Implement subsequent work on short-lived feature branches created from `develop`, using the `codex/` prefix and descriptive names such as `codex/crm-seguimiento`, `codex/admin-agencia` and `codex/users-roles`.
- Feature branches integrate into `develop`; validated releases move from `develop` to `main`. The user performs integrations and branch cleanup.
- Prefer one concrete functionality per branch rather than permanent branches for entire sections.
- Before editing project files, including documentation, inspect the current branch. If it is `main`, `develop` or an unrelated feature branch, tell the user which feature branch to create/switch to before making changes, unless the user explicitly authorizes an exception for that task.
- Version the lockfile and migrations with their corresponding changes. Never include secrets, local environment files, build artifacts or database runtime data in suggested commits.
