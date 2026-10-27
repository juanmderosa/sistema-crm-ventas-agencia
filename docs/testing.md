# Testing and acceptance contract

## Gates

Every feature: explicit acceptance criteria, risk assessment, implementation, applicable tests, review, user validation. Critical domain and permission rules get failing tests before implementation. No global percentage target. Do not test simple wrappers merely to increase counts.

Local quality command: npm run check (format, ESLint, TypeScript, Vitest). Build separately with npm run build. Browser suite: npm run test:e2e after installing Chromium using npx playwright install chromium. No production data or services in test fixtures.

## Layers

| Layer                  | Tool                                                   | Evidence                                                           |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Domain                 | Vitest                                                 | Invalid inputs, boundaries, monetary rules, idempotency semantics  |
| Interactive components | Testing Library + Vitest, introduced with forms        | Accessible labels, validation, errors, pending/submission behavior |
| Database               | pgTAP via Supabase CLI                                 | RLS under real roles, cross-agency FKs, function privileges        |
| Integration            | Real local Supabase                                    | Auth, Storage, Edge Functions, concurrent submission and retries   |
| E2E                    | Playwright                                             | Login, publish, public inquiry, assigned CRM follow-up             |
| Visual/accessibility   | Browser inspection + automated checks as features land | Mobile/desktop, keyboard, loading/empty/error states               |

Mocks may isolate UI network behavior; they do not prove permission or database safety. Async server pages are verified through browser requests, not artificial React render mocks.

## Mandatory security fixtures

Two agencies, each with superadmin/admin/two sellers, one inactive seller, and draft/published/reserved/sold vehicles. Distinct inquiries and private photos. A platform superadmin has an independent platform role. Test anonymous, each authenticated role and users without membership.

Negative cases: forged agency, cross-agency parent ID, role escalation, unassigned inquiry, draft metadata/photo, direct API access, archived membership. Positive cases accompany every deny test to avoid an accidentally unusable system passing security tests.

## Concurrency acceptance

Send simultaneous general inquiries for one vehicle through the real submission endpoint. Assert unique inquiries, balanced eligible rotation, no inactive recipients, same retry outcome, no extra turn on retry, explicit seller not advancing rotation and fallback with zero eligible sellers. SQL tests alone are not sufficient for endpoint idempotency.

## Data and file acceptance

Reject over-limit files, deceptive extension/MIME, malformed payloads, dimensions over limit and animated PNG/WebP. Count enforcement is atomic under parallel uploads. Failed uploads cannot leave public/orphaned files or exceed 12 photos. Logo and vehicle policies are separate.

## CI and runtime

The Quality workflow runs on pull requests targeting `develop` or `main`, plus manual dispatch. It does not run on every push or repeat after merge. New commits to the same PR cancel older runs. Keep the `application` check required in branch protection; the workflow always reports it, including documentation-only PRs.

Only root Markdown files and Markdown under `docs/` qualify for the lightweight path. It runs CI selector tests and formatting with the exact Prettier version from package.json, without installing application dependencies, Chromium or building the app. All other changes, mixed changes and manual runs use the full suite. Deletions and renames participate in detection. Comparison errors fail the job; an empty diff defaults to full checks. There are no workflow-level path exclusions that could leave a required check pending.

Application checks: clean npm install from lockfile, quality checks, production Next build and Chromium smoke tests. Add real database jobs with the first migration; do not claim them before they run. OpenNext build is an independent compatibility gate. Worker runtime and quota measurements are required before pilot, as are recovery rehearsal and privacy review of logs.

The workflow change itself requires the full suite once. Already-started runs retain the old workflow and must finish or be canceled manually in GitHub. The lighter path applies to subsequent documentation-only PRs once this workflow is in use. Measure remote timing before adding browser caches or a container image.

## Definition of done

Acceptance criteria passed; backend authorization verified; error states implemented; no known integrity defects; documentation updated. Report commands/results and blockers honestly. A skipped test is not a pass. Production deployment is a separate action from local feature acceptance.
