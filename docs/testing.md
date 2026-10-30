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

### Password recovery

Development and production startup need separate checks: Next dev validates the HMR WebSocket origin, while the production E2E server has no HMR connection. `next.config.ts` explicitly allows only the additional loopback host `127.0.0.1`, used in recovery mail. After changing that configuration, check input focus, typing and validation on both `localhost:3000` and `127.0.0.1:3000` with `npm run dev`; production E2E alone does not cover this failure. Keep the shared hydration guard: a blocked development connection must be corrected at its source.

The recovery suite sends actual recovery mail through local Auth and reads the unique synthetic recipient through Mailpit's local API. It opens the emailed link in a separate browser context with a different user's existing session, checks that only the email owner's password changes, rejects the old password, accepts the new password, rejects reuse, and confirms logout. Other cases cover absent accounts, malformed/duplicate/forged tokens, ordinary-session denial, eight-character/matching-password validation, ignored external redirect parameters and private/no-referrer response headers. After following the client-side login link, the test waits for the recovery heading before filling the email: both pages have an email input, so filling immediately can target the departing login form.

`APP_ORIGIN` is runtime configuration validated as a bare HTTPS origin (HTTP loopback only for local development). The E2E wrapper sets it to the selected Next/Worker origin; no submitted URL controls email destinations. Domain tests cover origin restrictions, token shape, password preservation/confirmation and server submission proof. The local Auth configuration also enforces eight characters. Recovery clients use only public credentials with in-memory sessions; fixture provisioning remains confined to the test process. GET does not consume a token; verification and update occur together on submission. An Auth failure after token consumption requires a new email.

Real one-hour expiry is a separate manual check in [the recovery guide](manual-password-recovery.md); the automated suite does not wait an hour or claim that an altered/reused token proves time-based expiry. Remote SMTP, deployment configuration and real mailbox delivery are not certified by local Mailpit tests. No database fixture SQL is needed for the manual recovery flow when an Auth test account already exists.

### Platform agency creation

`supabase/tests/agency_creation.test.sql` adds thirty real PostgreSQL assertions: anonymous/missing/forged identity denial; denied agency roles; active/revoked platform behavior; exact decimal storage; duplicate-slug rejection; client audit mutation denial; audit visibility; and full rollback when a synthetic audit trigger rejects the event. The original 105 authorization assertions remain unchanged. Fixtures and the rejecting trigger roll back with the suite.

`agency-creation.spec.ts` provisions unique local Auth identities and a temporary platform assignment. It verifies shared input focus and field errors, actual UI creation, exact decimal persistence and actor audit, duplicate feedback, action denial after live revocation, anonymous/ordinary route and RPC denial, simultaneous public-key RPC calls with exactly one successful creation/event, pagination and malformed/duplicate page selectors. The service-role client prepares/checks/removes synthetic fixtures only; application and concurrent RPC calls use public credentials and user sessions. Cleanup targets exact generated slugs and the fixture actor's events, then removes its assignment before shared identity teardown. No customer data, reset or global cleanup.

See [manual platform creation](manual-agency-creation.md) for bootstrap SQL, permission checks and narrowly scoped cleanup preserving Auth users/profiles. A real platform actor is required before the first UI creation. Creation does not assign an agency superadmin or test invitation flows. HTTP `ERR_NETWORK_IO_SUSPENDED` during a local run invalidates that run; repeat after connectivity resumes without increasing application/test timeouts.

### Initial superadministrator assignment

The 22 assertions in superadmin_assignment.test.sql first fail without the RPC, then verify anonymous/forged/agency-role/revoked denial, inactive agency and missing profile rejection, fixed active role, actor/target attribution, immediate RLS access, prevention of replacement and silent promotion, preservation of inactive owner history, direct-write denial and full rollback under a synthetic audit failure. Prior suites remain enabled (157 SQL assertions total).

The new E2E suite verifies UI assignment to another real local Auth identity/profile, shared Select focus/errors, persistent owner display, full selected ID visibility, actual agency access after reload, denied platform access for the new agency owner, denied anonymous/ordinary/revoked actors, inactive/invalid routes, and two distinct simultaneous targets producing exactly one membership/event. It uses public credentials and user sessions for actual writes. Privileged clients are fixture-only, with exact agency-scoped audit/membership cleanup before removing identities. Manual setup and scoped cleanup are in [the assignment guide](manual-superadmin-assignment.md). New account creation, email invitations and owner replacement are not certified by this increment.

### Superadministrator invitations

The 30 invitation SQL assertions cover unauthenticated/forged denial, slot reservation, service-only callbacks/Auth lookup, recipient binding, no direct/private-core mutation, expiry, revoked inviters, configured-password requirement, current-email matching, rollback on audit failure, single redemption and late delivery after cancellation. Together with the unchanged prior assertions this is 187 checks. Fixture-only timestamps/password markers isolate database rules; actual email proof/password policy are certified by real Auth E2E, not those markers.

Five new E2E cases run on desktop/mobile: real Edge/Auth/Mailpit delivery and cross-browser acceptance, no early membership (including the previous assignment route), ordinary/forged callers, confirmed existing accounts without profiles and password preservation, cancellation/re-invitation, expired reservations, interrupted acceptance resumed by the correct identity, competing senders/acceptances, and cross-invitation identity denial. Fixtures use unique fresh emails and exact agency IDs, remove invitation-linked audit before invitation/membership/profile references, and delete only their newly invited Auth users. Existing manual identities are never deleted. Application call paths use public credentials; the administrative key stays inside Edge except fixture setup/inspection.

The Deno CLI is pinned as a dev tool. `npm run functions:typecheck` uses the official Deno types and frozen generated lockfile. Dependency changes require an intentional `npm run functions:lock`, reviewed deno.lock and root package-lock changes. No handwritten runtime shims certify the function. Next.js typecheck excludes Edge source; Deno and ESLint check it separately.

Start `npm run functions:serve -- --e2e` in a separate terminal before Next E2E, or `--worker` for Worker tests. Stop/restart it when switching origins. The E2E wrapper waits for the function's own 401 response before opening browsers and fails explicitly if it is unavailable. CI starts it with logs hidden. The manual default reads APP_ORIGIN from the environment/local file. See [manual invitations](manual-superadmin-invitations.md) for complete local commands and ready-to-run SQL preserving existing records. Timestamp expiry tests certify the invitation reservation; the one-hour Auth token clock remains a manual test. Local success does not certify remote SMTP or Edge deployment.

The complete invitation Worker suite was verified with `--workers=1`: a two-worker run left one desktop login/navigation pending beyond the unchanged five-second assertion window; its trace recorded a delayed HTTP 200 login response, while the other nine cases passed. All ten passed serially, retaining the explicit parallel sender/acceptor API calls. This bounds functional local verification, not production latency or load capacity. Other Worker suites retain their existing default concurrency.

### Agency user invitations — database increment

`agency_user_invitations.test.sql` adds 52 pgTAP assertions (239 total). They first failed against the absent RPC/table, then passed on the migrated real local PostgreSQL. They cover the role matrix, foreign agencies, forged metadata, platform-only denial, RLS, service-only binding, direct-write/private-helper denial, cancelled/expired states, author demotion/revocation, inactive agencies, recipient/email/password checks, independent multiagency roles, preserved inactive memberships/profiles, and atomic rollback on audit failure. Synthetic rows and the failure trigger live in a transaction ending in ROLLBACK; no manual account setup is needed.

`npm run db:test:user-invitation-concurrency` uses two independent psql connections through the local Docker container selected by supabase/config.toml. Simultaneous authorized senders produce one live reservation; simultaneous acceptances produce one active membership and exactly three invitation-linked audit events. It validates business-conflict errors, uses random synthetic UUIDs/emails, and cleans only those UUIDs in finally. SQL password markers isolate database checks; they do not certify real password login or mail proof. CI runs this command after migrations/pgTAP/types. Remote CI still requires an actual run.

For local verification, run `npm run db:migrate`, `npm run db:test`, `npm run db:test:user-invitation-concurrency` and `npm run db:types:check` with Docker/Supabase running. Neither test command requires manual SQL fixtures. Application email/screens are intentionally absent in this increment; existing invitation E2E remains regression coverage for the initial-owner workflow. Employee Auth/Edge/Mailpit/E2E and Worker checks are described in the application increment below.

### Agency user invitations — application increment

The application increment adds unit validation of target roles/agency selectors and a service-only existing-identity adapter SQL suite. Browser cases exercise real local Edge/Auth/Mailpit: cross-browser new-account acceptance, no early access, fixed admin role, admin-only-seller controls and direct RPC/Edge denial, ordinary/foreign/platform-only denial, cancellation and invalidated acceptance, existing account password/profile/other-agency preservation, revoked-author interruption and correct-user session resumption, and URL pagination/invalid selectors. The initial browser run exposed a test navigation race; this suite now waits for the login's panel/platform navigation before issuing another navigation, retaining existing timeouts.

Start `npm run functions:serve -- --e2e` for Next or `--worker` for local Worker. The helper now serves both functions, each with its explicit bearer validation; the browser preflight checks both. Manual commands and SQL setup/verification/scoped cleanup are in [agency user invitations](manual-agency-user-invitations.md). The setup preserves all prior Auth/profiles and existing agency assignments; it is not executed as part of implementation. Actual email proof is certified by browser tests rather than SQL password markers. Auth's full one-hour clock and hosted SMTP/Edge/CI remain separate checks.

### Agency membership management

`agency_members_management.test.sql` verifies protected owner/self, peer-admin denial, seller/platform/foreign denial, bounded paginated roster, inactive visibility, stale/no-op/null state denial, independent other-agency roles, reactivation, actor/agency revocation, direct-write denial and audit rollback/attribution. Tests first fail without the RPCs; fixtures and rejecting trigger roll back. `npm run db:test:member-concurrency` uses independent local psql sessions and explicit barriers: competing expected-state mutations yield one event, and a target admin holding SHARE while waiting for the agency produces 40001 rather than deadlock. Revocation succeeds on retry after release. Only generated fixture UUIDs are cleaned. CI includes the command.

`members.spec.ts` checks actual toggles, protected controls, access loss/restoration on reload with other agency access preserved, audit, stale UI, revoked actors and malformed/private routes. The [manual guide](manual-agency-members.md) provides setup, verification and scoped cleanup SQL preserving Auth/profiles/platform. No manual fixture execution, customer data, privileged application client or QueryClient is introduced. These checks do not certify a future private browser cache or future inventory/CRM rotation behavior.

### Agency member role changes

The role-change pgTAP suite first fails without the RPC/columns, then covers owner-only grants, anonymous/admin/seller/platform/foreign denial, self/owner protection, stale role/state and no-op rejection, inactive preservation, independent agency roles, live owner/agency revocation, pending invitation rejection after active inviter demotion, direct-write denial and audit rollback/attribution. The existing member concurrency command additionally races identical role changes (one event) and uses explicit barriers to verify both status and role conflicts with invitation locks, followed by successful retries.

The member E2E suite adds promotion/demotion with live access checks in another browser, unchanged other-agency access, inactive preservation, stale activation snapshots, disabled no-op controls, admin/platform-only denial and a revoked owner's open form. Assertions wait for the server-rendered role paragraph after reload, rather than the select's optimistic local value. SDK test signouts use local scope to avoid revoking a browser session of the same identity. The [manual role guide](manual-agency-member-roles.md) includes ready SQL setup, audit queries and scoped cleanup using the QA accounts while preserving Auth/profiles/prior access. No manual setup SQL is executed by implementation.

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
