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

## Agency authorization foundation

With local Supabase running, apply pending migrations using `npx supabase migration up --local` (no reset), then run `npm run db:test`. The agency/role suite uses pgTAP against PostgreSQL with actual `anon`/`authenticated` roles and synthetic JWT subjects. Fixtures and test-only helpers run inside a transaction ending in ROLLBACK; do not use customer data or reset an existing database to run these tests.

Platform-wide visibility counts are scoped to the suite's fixture IDs so unrelated manual QA data does not change expected totals. Authorization denial/positive cases remain enabled. The [manual authentication/access guide](manual-auth-access.md) describes account/profile/agency setup, role changes, revocation and same-browser identity switching.

The 105 assertions cover two agencies with superadmin/admin/two active sellers/one inactive seller each, a member with different roles in both agencies, active/inactive platform assignments and a user without membership. Checks include permitted reads, cross-agency denial, private profiles, forged user metadata, inactive agencies, immediate revocation, client write denial, role escalation, constraints and RLS activation. Inventory, Storage, endpoint authentication and concurrency are outside this schema increment and are not certified by these tests. The full CI path starts an isolated Supabase instance on the runner, applies migrations, runs pgTAP and checks generated types as part of the required `application` check. Documentation-only PRs keep the lightweight path. Startup output is not printed or uploaded because it can contain local keys. No remote Supabase secrets or production connection are needed.

## Mandatory security fixtures

### Authentication increment 1

Start local Supabase, apply migrations with `npm run db:migrate`, configure the public HTTP API URL (not the PostgreSQL connection string) and public key in `.env.local`, and build with `npm run build`. Then run `npm run test:e2e`; Chromium must be installed. After changing Auth configuration, restart the local stack with `npm run db:stop` then `npm run db:start`. Do not use `--no-backup` or reset the database.

The E2E wrapper reads local CLI status into memory, validates a loopback API URL, and passes public configuration plus a local-only test service-role key to the Playwright process. It never prints or writes credentials. The web server receives an empty test service-role variable; application code uses only a public key. The test process alone uses the privileged local key to create unique synthetic Auth users/profiles and delete exactly those identities in fixture teardown. There is no broad table cleanup, database reset or remote provisioning. Do not commit `.env.local`, CLI runtime files or `test-results` (traces can contain synthetic credentials).

To check the same flows in the local Worker, run `npm run cf:build`, then start `npx wrangler dev --local --ip 127.0.0.1 --port 8787 --env-file .env.local` in a separate terminal and run `npm run test:e2e:worker`. This mode uses the fixed loopback address and does not start or reuse a Next server. Stop Wrangler afterward. The current CI runs the Next E2E suite and Cloudflare packaging separately; it does not run the Worker E2E command. Local success does not certify deployment or remove OpenNext's experimental Node.js middleware warning.

Acceptance covers login success, generic invalid-credential errors, field validation, private response cache headers, anonymous and forged-cookie denial, persistence across reload, logout and server-side cookie refresh via real local Auth. The refresh test marks the session record expiry stale and redeems a genuine refresh token; it does not wait for JWT expiration or certify production token lifetime behavior. The direct signup test checks that global signup stays disabled while email login works. Tests run on desktop/mobile and capture the empty login screen for visual review. Authentication unit tests cover malformed inputs, bounds and password preservation.

### Access context increment 2

The shared local Auth/profile fixtures support `access.spec.ts`, which provisions two synthetic agencies and independent assignments, and tears them down by their own IDs in foreign-key order before retiring the identities. The application queries access using only the public key plus the signed-in user's session; privileged clients are restricted to fixture setup/changes/cleanup. Real E2E covers anonymous routes, single-agency entry, multiple agencies with different roles, forbidden/malformed/duplicate agency selectors, forged role parameters, inactive memberships/agencies, live role changes and membership/agency/platform revocation on reload. It also signs out and into a different identity in the same browser and checks that the old agency cannot be reopened. A no-membership login remains an authenticated session with an explicit no-access state and logout.

Pure domain tests check the selection states, but only real Supabase E2E and pgTAP certify authorization. These access pages use fresh server reads and document navigation, with no client data cache; the same-browser test does not certify a future TanStack Query cache implementation. Revocation is enforced on the next request; an already rendered page is not updated by a realtime subscription. Invalid agency selection renders an explicit denial state without tenant details; unauthorized platform entry returns 404. Database/transport failures must remain errors, never a fabricated no-access result.

Worker-mode browser checks use two Playwright workers to avoid contention in local workerd. Assertions and timeouts are unchanged; this is functional verification, not a production load test. Next-mode concurrency is unchanged.

### Full product fixtures

Two agencies, each with superadmin/admin/two sellers, one inactive seller, and draft/published/reserved/sold vehicles. Distinct inquiries and private photos. A platform superadmin has an independent platform role. Test anonymous, each authenticated role and users without membership.

Negative cases: forged agency, cross-agency parent ID, role escalation, unassigned inquiry, draft metadata/photo, direct API access, archived membership. Positive cases accompany every deny test to avoid an accidentally unusable system passing security tests.

## Concurrency acceptance

Send simultaneous general inquiries for one vehicle through the real submission endpoint. Assert unique inquiries, balanced eligible rotation, no inactive recipients, same retry outcome, no extra turn on retry, explicit seller not advancing rotation and fallback with zero eligible sellers. SQL tests alone are not sufficient for endpoint idempotency.

## Data and file acceptance

Reject over-limit files, deceptive extension/MIME, malformed payloads, dimensions over limit and animated PNG/WebP. Count enforcement is atomic under parallel uploads. Failed uploads cannot leave public/orphaned files or exceed 12 photos. Logo and vehicle policies are separate.

## CI and runtime

The Quality workflow runs on pull requests targeting `develop` or `main`, plus manual dispatch. It does not run on every push or repeat after merge. New commits to the same PR cancel older runs. Keep the `application` check required in branch protection; the workflow always reports it, including documentation-only PRs.

Only root Markdown files and Markdown under `docs/` qualify for the lightweight path. It runs CI selector tests and formatting with the exact Prettier version from package.json, without installing application dependencies, Chromium or building the app. All other changes, mixed changes and manual runs use the full suite. Deletions and renames participate in detection. Comparison errors fail the job; an empty diff defaults to full checks. There are no workflow-level path exclusions that could leave a required check pending.

Application checks: clean npm install from lockfile, quality checks, production Next build and Chromium smoke tests. Database checks use real local Supabase on the ephemeral Linux runner; a configured workflow is not evidence of a successful remote run. OpenNext build is an independent compatibility gate. Worker runtime and quota measurements are required before pilot, as are recovery rehearsal and privacy review of logs.

The workflow change itself requires the full suite once. Already-started runs retain the old workflow and must finish or be canceled manually in GitHub. The lighter path applies to subsequent documentation-only PRs once this workflow is in use. Measure remote timing before adding browser caches or a container image.

## Definition of done

Acceptance criteria passed; backend authorization verified; error states implemented; no known integrity defects; documentation updated. Report commands/results and blockers honestly. A skipped test is not a pass. Production deployment is a separate action from local feature acceptance.

## Generated database types

Run `npm run db:migrate` against the running local instance, then `npm run db:types`. The script invokes the pinned Supabase CLI with `--local --schema public` and formats its output with the existing Prettier configuration. Commit `src/lib/supabase/database.types.ts` with the corresponding migration; never edit generated definitions manually. `npm run db:types:check` compares live generation without modifying the file and fails on drift, missing files or generation errors. These structural types do not encode grants, RLS or CHECK constraints and are not authorization guarantees.
