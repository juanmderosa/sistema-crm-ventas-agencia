# Architecture — accepted baseline

## Product boundary

One product, one repository, multi-agency database. Stage 0 supplies a reproducible foundation; later stages implement business capabilities. Public identity is configurable. No visual page builder, payments, WhatsApp message ingestion or image conversion in the MVP.

## Runtime and responsibility

Next.js App Router + React + strict TypeScript; Tailwind and shadcn-compatible components. Public pages render on the server. Interactive panel uses TanStack Query. Forms use React Hook Form + Zod. Recharts is reserved for the statistics feature, not installed before it is used.

Supabase owns Auth, PostgreSQL, private Storage and Edge Functions. Sensitive public submissions and privileged user/image operations use Edge Functions; atomic changes use restricted SQL functions. Next.js server rendering uses a request-scoped Supabase client. The browser never receives a service-role key.

Cloudflare Workers through OpenNext is the intended pilot runtime. Standard Next build, OpenNext build, local Worker execution and authenticated deployment are separate verification gates. Free-tier suitability is measured, not assumed.

## Module boundaries

- src/app: routing, layouts and composition only.
- src/features/<feature>: components, schemas/domain, queries and server data adapters as needed.
- src/components/ui: shared presentation primitives.
- src/lib: infrastructure and narrow cross-feature helpers.
- supabase/migrations: reviewed schema and policy evolution.
- supabase/tests: actual database policy/integrity tests.

Do not add empty layers to every feature. Extract responsibilities when the implementation needs them. Shared schemas validate shape; database constraints and backend checks remain authoritative for authorization and integrity.

Database queries live in named feature-specific data-access functions, separate from their callers. Access query construction and response validation live in `src/features/access/server/queries.ts`; the context resolver verifies identity, invokes those functions and assembles the result. Reuse a query function rather than copying its Supabase query into another caller. Clients remain request-scoped and authorization remains explicit. Application forms use shared `Form` and `Input` components in `src/components/forms` for consistent labels, refs and errors; React Hook Form/Zod keep their existing state/validation responsibilities. Event workflows are named functions outside JSX. These conventions are mandatory in `AGENTS.md`.

## State ownership

Public server-rendered data is not automatically copied into a client cache. Panel query keys begin with private/userId/agencyId. Session change must clear QueryClient before rendering another identity. Filters, sort and pagination live in URL search parameters. Form state stays in React Hook Form. Local modals and transient selection stay in React state. No Redux/Zustand initially.

## Security boundaries

Agency is resolved from public route or an authenticated membership; a supplied agency ID is never proof of access. Composite foreign keys bind child and parent to the same agency. RLS applies to every business table; private Storage policies bind objects to an authorized vehicle or agency. Role creation/update is privileged, audited and cannot be accomplished by editing a profile.

Public access exposes a limited projection of published vehicles and public agency/seller fields. Internal notes, contact data and drafts never belong to public responses. Draft image URLs must not become reusable public object URLs. Published media access and revocation are tested before inventory is accepted.

## Business decisions

### Authentication foundation

Email/password authentication uses Supabase Auth through Server Actions and request-scoped `@supabase/ssr` clients. React Hook Form owns the login form and the shared Zod schema validates both browser input and untrusted action arguments. `server-only` protects infrastructure imports. These dependencies are introduced here because the functionality now uses them; versions and lockfile are exact. No dependency upgrade or change to the OpenNext/glob decisions is part of this increment.

Next.js Proxy validates/refreshes the session on `/login`, `/cuenta`, `/panel` and `/plataforma` and forwards updated cookies and cache headers. Each private render independently validates the user with Auth `getUser()`. A verified identity is not proof of agency access: `/cuenta` exposes only the authenticated user's email and logout. `/panel` queries that user's active memberships joined to active agencies under RLS; `/plataforma` separately requires the user's active platform assignment. Responses are validated with Zod and database/validation errors fail explicitly rather than becoming an empty successful result.

After login, `/panel` opens the single available agency, offers a choice for multiple agencies or shows no enabled access. Active platform administrators land on `/plataforma`; its minimal entry shows the verified identity and platform role, with links to any explicit agency memberships. Global agency administration remains future work. Each agency selection uses `/panel?agency=<uuid>` and full document navigation. The URL is an untrusted selector, never proof of authorization; malformed, duplicate, foreign and revoked selectors show a generic denial without agency details. With no selection, access is resolved again from current assignments. No agency preference is persisted in cookies or user-editable metadata. Current roles come from the database on every request, so revocations/role changes apply on the next request without signing in again. Unauthorized platform entry returns 404; missing sessions redirect to login.

There is no browser Supabase client or private QueryClient in these increments. Access context is request-scoped Server Component data, not duplicated into a client cache. Auth cookies are HttpOnly, SameSite=Lax and Secure for production HTTPS Supabase configurations; local HTTP is development-only. Login/logout and agency switching navigate to a new document to discard any prior client memory. Logout uses local scope (this browser session), not global device logout. Private routes are dynamic and carry `private, no-store` cache headers, including cookie refresh responses. Future interactive remote panel data must use TanStack Query with user/agency keys and explicit clearing on context/session changes; future private data adapters must check access independently. Public configuration is validated at server runtime so tests/deployments can provide their own API URL and public key; privileged keys are rejected. Cloudflare production configuration still needs its environment bindings configured and verified before pilot.

The global Auth signup switch remains off. With CLI 2.122.0 the local email flag must be on to enable the password provider; E2E checks verify password login succeeds while public signup remains rejected. Local configuration changes require a data-preserving Supabase restart, never a reset.

Shared forms disable their fieldset until hydration attaches handlers, and while submission is pending. Logout also stays disabled until hydrated. This prevents a server-rendered control from appearing interactive before its client code can handle a click. `useHydrated` uses React's server/client snapshots without changing form-state ownership.

Reference: [Supabase SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [session/cache behavior](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

### Password recovery

Recovery requests use a request-scoped public-key Auth client without cookies or persistent storage. `APP_ORIGIN` supplies the trusted destination; submitted redirect parameters and Host headers never choose it. The recovery email template links directly to `/recuperar/confirmar?token_hash=...`, using Supabase's `RedirectTo` and `TokenHash` template variables. This supports opening the email in another browser without a PKCE verifier from the initiating browser. Existing and absent accounts receive the same successful request message; service/rate failures remain explicit errors.

GET renders the form without consuming the token. The Server Action validates the password and token shape, verifies the token specifically as `recovery`, changes the authenticated token owner's password and closes the temporary Auth session. No recovery session is installed in browser cookies, and an existing panel session cannot select the password owner. Successful completion signs out the current browser and returns to login. Invalid/expired/used links require a new request; an update failure after verification also requires a new link because verification consumes it. Auth controls single use and expiry; the application uses no recovery table, privileged client or new dependency. Recovery pages are dynamic with no-store and no-referrer headers. New passwords require eight characters in both Zod and local Auth; login preserves compatibility with existing passwords.

The local template and Auth configuration must be applied separately to a hosted project before deployment. See [manual recovery checks](manual-password-recovery.md) and [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

### Platform agency creation

`/plataforma/agencias` lists active and inactive agencies in pages of twenty, ordered by creation timestamp and UUID. `/plataforma/agencias/nueva` provides the shared RHF/Zod creation form. Server pages and actions verify a live platform assignment; an agency role never grants platform administration. The application uses request-scoped public-key clients under RLS. Queries and RPC calls are centralized in the agencies feature adapter. Pages render fresh server data and creation navigates to a new document; no client remote list state or QueryClient is introduced.

Migration `20261027010000_platform_agency_creation.sql` adds only the restricted `create_agency` function and minimal `audit_events` for `agency.created`. The SECURITY DEFINER function has an empty search_path, explicit grants and an authoritative platform check locked until transaction commit. It derives the actor from auth.uid(), accepts no owner/role/active-state arguments, validates inputs again and inserts agency plus audit atomically. Direct table writes remain forbidden. Audit reads require active platform access; application clients cannot insert, alter or delete events. Actor and agency foreign keys restrict deletion.

ARS/USD input remains decimal text through validation and RPC and is cast to PostgreSQL numeric only after rejecting excess size/precision, exponents, nonfinite values and nonpositive rates. List reads cast numeric to text, preserving precision without JavaScript floating-point conversion. A unique canonical slug rejects simultaneous duplicate creation. New agencies are active with no memberships; owner assignment, invitations, editing/deactivation and rate-change history are separate increments. The first platform assignment remains an explicit local bootstrap, not a public self-promotion endpoint.

### Initial agency superadministrator

`/plataforma/agencias/[agencyId]/superadministrador` verifies platform access and shows either the recorded owner(s), inactive-agency state, or a paginated selector of existing profiles. It identifies users by display name and UUID, with a full selected-identity summary that remains readable on mobile. RHF/Zod owns the form; the shared Select supports labels, refs and accessible errors. Profiles are read server-side in pages of twenty; URL owns pagination and no browser Auth admin client or client remote cache is introduced.

Migration `20261028000000_initial_agency_superadmin.sql` adds the restricted `assign_initial_agency_superadmin` RPC. The function locks the actor's active platform assignment and then the active agency, serializing competing initial assignments. It verifies an existing profile, rejects any prior superadministrator (including inactive history), and inserts a new active membership with a fixed agency_superadmin role. Existing memberships are never promoted, replaced or reactivated. Actor/role/activity come from server/database rules rather than request arguments. The membership and `membership.superadmin_assigned` event commit together; audit target_user_id references the assigned profile, separately from actor_id. Audit action constraints retain compatibility with earlier agency.created events, whose target is null. Direct client writes and audit RLS remain unchanged.

This increment handles existing profiles only; creating Auth accounts, invitations, replacing owners, reactivation and managing other roles remain separate work. Profiles without email are still identifiable by UUID; the application does not query auth.users or use a privileged key to discover addresses. Bootstrap/manual SQL preserves existing Auth identities/profiles.

### Superadministrator invitations

Platform can invite a new account through `/plataforma/agencias/[agencyId]/invitar`; `/invitaciones/aceptar` verifies the email proof, sets a password, and redeems the stored invitation. Administrative Auth calls live only in `supabase/functions/invite-agency-superadmin`. The Edge Function verifies the bearer token with Auth and reserves the slot through a user-scoped RPC before allocating its request-scoped administrative client. Gateway JWT verification is disabled specifically because the handler performs its own authenticated verification; this is not an anonymous provisioning endpoint. No service-role key is configured in Next.js or sent to the browser. The function uses a separately configured trusted APP_ORIGIN, never a client redirect or Host header.

The persistent invitation is authoritative for agency, inviter, normalized email, bound Auth identity and expiry. `begin_superadmin_invitation` locks the platform assignment/agency and reserves one live initial slot; the existing-profile assignment also respects that reservation and now requires confirmed email. The service-only delivery callback validates the invited Auth identity, creates its profile without overwriting existing names, records invitation.sent, and marks sent. A request by an ordinary authenticated caller cannot bind identities or claim delivery. The service-only existing-account adapter prepares a missing profile for a confirmed Auth account but neither changes passwords nor grants membership; the sender must use the explicit existing-user assignment instead. Failed delivery never activates a role.

| Stored state | Meaning                                                                  | Membership from this invitation |
| ------------ | ------------------------------------------------------------------------ | ------------------------------- |
| sending      | Reservation created; delivery not yet confirmed                          | None                            |
| sent         | Auth reported delivery and identity binding was saved                    | None until acceptance           |
| failed       | Provider rejected the attempt, including an already registered account   | None                            |
| cancelled    | Platform explicitly invalidated the reservation                          | None                            |
| accepted     | Identity, password, authority and expiry verified; transaction committed | Active agency_superadmin        |

Expiry is derived from expires_at for pending rows, without rewriting history. It limits redemption, not the lifetime of an accepted membership. There is no automatic owner replacement or role promotion. Every mutation locks platform → agency → invitation consistently. Acceptance derives the recipient from auth.uid(), checks current confirmed email/password against auth.users and the bound identity, revalidates inviter/agency activity and creates the membership plus audit/state atomically. The private mutation core has no client execution grants. Sent/accepted/cancelled events reference the invitation and preserve author/recipient separately. Existing inactive owner history continues to block a new initial owner.

Auth/email and PostgreSQL cannot share a transaction. Transport/server uncertainty stays sending, with explicit review/cancellation; a definite provider rejection becomes failed. Password activation can succeed before a rejected membership transaction. In that case the correct user can log in and redeem a still-valid sent invitation without reusing the consumed token; other users cannot resume it. A verified link whose password update failed uses password recovery before authenticated resumption. Confirmed existing accounts are never reset through the invitation API. A cancelled unconfirmed account can receive a fresh invitation; the previous record remains invalid. Accounts/profiles are not silently deleted as compensation.

Public-key ephemeral Auth clients are shared infrastructure for recovery and invitation verification, created per operation without cookies or persisted tokens. Successful first acceptance closes that temporary session and the current browser session, then returns to login. Authenticated resumption navigates to a fresh panel document. Forms use RHF/Zod and shared inputs; status lists remain fresh Server Component reads. Token pages are dynamic, private/no-store, no-referrer and not indexed; GET does not consume email tokens.

The function pins its SDK/Zod versions in deno.json and its generated deno.lock; Deno 2.9.6 is a justified development-only dependency for official runtime type checking with --frozen. The root lockfile records that tool; application SDK versions and the OpenNext override remain unchanged. `npm run functions:serve` supplies only the public origin in a temporary file; Supabase owns administrative runtime credentials. CI starts the local function before real mail E2E. Hosted deployment, SMTP, template Invite and the Edge Function origin are separate acceptance gates.

### Agency user invitations — database increment

Migration `20261029000000_agency_user_invitations.sql` implements the database contract only. `agency_user_invitations` stores the fixed target role (`admin` or `seller`), agency, author, normalized email, bound recipient, expiry and lifecycle. It is separate from the initial-owner reservation: that workflow allows only one historical owner and authorizes platform, whereas agency managers may invite multiple independent employees. Existing owner RPCs, Edge Function and acceptance page continue to handle only `agency_invitations`; the database increment exposed no employee email/UI workflow; the application integration is described below.

`begin_agency_user_invitation` derives the author from auth.uid(). An active agency superadmin may invite admins/sellers; an active admin may invite sellers only. Platform access alone is insufficient. The private authoritative helper locks the inviter membership with SHARE, then the active agency with UPDATE; all subsequent invitation locks follow that order. Send confirmation and acceptance revalidate the author's current permission for the stored role, so demotion/revocation can invalidate a pending invitation. Direct client table writes and calls to the helper are forbidden. RLS permits owners to read agency invitations, admins to read seller invitations, and bound recipients to read their own; audit remains platform-readable only.

The service-only `finish_agency_user_invitation` checks the Auth identity/email, prepares a missing profile without overwriting existing names, and records delivery; it grants no membership. `accept_agency_user_invitation` requires the bound authenticated recipient, current confirmed email/password, a sent/unexpired invitation, and live author/agency authority. It atomically inserts the stored membership, membership audit, acceptance state and acceptance audit. Existing memberships, including inactive ones, are rejected rather than promoted/reactivated. A person can hold independent roles in different agencies. Cancellation requires current permission for the target role and cannot undo acceptance. SQL state expiry does not certify Auth email token expiry.

The agency lock serializes same-agency reservations and acceptance; duplicate live agency/email reservations fail. This initial bounded implementation prioritizes integrity over parallel writes within one agency. Email delivery, uncertain transport outcomes, existing-account email UX and the application adapters are described in the application increment below; the service callback is a trusted boundary, not proof of actual SMTP delivery by itself. No new dependency or privileged application client is introduced.

### Agency user invitations — application increment

`/panel/usuarios?agency=<uuid>` independently checks the current agency membership and exposes only invitations for roles the actor can manage. Owners can invite admins/sellers, admins only sellers. Twenty-item SSR pagination is URL-owned; no browser SDK, client remote cache or QueryClient is introduced. Queries and mutations live in the user-invitations feature adapter. Agency selection, page, submitted role and all returned rows are validated. The server action and SQL separately enforce authorization, including cancellation against the invitation's actual agency/role.

The `invite-agency-user` Edge Function follows the same authenticated provisioning boundary as initial-owner invitations, with its own guarded RPCs and pinned Deno config/lock. It validates the bearer with Auth, reserves under the caller's session, then allocates its administrative client. New accounts receive Invite mail and set a password. For confirmed existing accounts, the service-only `prepare_existing_agency_user_invitation` resolves only the email on the live authorized reservation; no arbitrary-email lookup is exposed. Public Auth signInWithOtp with shouldCreateUser=false sends a Magic Link to the fixed trusted origin/path. Delivery confirmation binds the existing identity without changing its password/profile/other memberships. Transport/server uncertainty remains sending; known rejection becomes failed.

`/invitaciones/usuarios/aceptar` shares the existing password form, cancellation and resumption controls with explicit invitation kind. New-account proof is verified as invite; existing-account proof as magiclink, without password update. Both use a per-operation ephemeral client, call their dedicated acceptance RPC, close that session and logout the previous browser identity on success. No token session is persisted in cookies, and GET consumes nothing. Failed acceptance can resume with the bound user's ordinary session; password recovery covers consumed proof before password activation. Method/kind parameters choose a flow but grant no role: stored identity/agency/role and current author authority remain authoritative. Initial-owner acceptance remains separate and backward compatible.

The local helper serves both functions and the E2E preflight waits for each handler's 401 envelope. Auth redirect URLs and Magic Link template are versioned local configuration, applied with a data-preserving restart. Hosted SMTP, templates, exact allowed URLs, APP_ORIGIN and both Edge deployments require separate configuration/verification.

### Agency membership management

`/panel/usuarios/miembros?agency=<uuid>` lists twenty members per page (including inactive), displaying name/user UUID/role/state. URL owns pagination; fresh Server Components and full document reload after mutation avoid introducing client remote cache. Existing agency management authorization is reused; data access is isolated in the members feature. Global profiles RLS is unchanged: guarded `list_agency_members` exposes only names linked to the selected agency's roster, without Auth emails. It requires an active management membership and agency, irrespective of platform assignment.

`set_agency_member_active` allows owners to manage admins/sellers and admins to manage sellers, excluding the actor and every superadmin. It never changes roles, deletes accounts or modifies another agency. Requested/expected booleans must represent a real transition; stale expected state fails with 40001. Locks follow actor SHARE -> agency UPDATE -> target UPDATE, consistent with invitation APIs. Target UPDATE uses NOWAIT: a target admin can already hold SHARE while waiting for the agency in an invitation transaction, so waiting there would create a lock cycle. Conflicts abort for explicit reload/retry; a later successful revocation invalidates that author's pending grants. State and membership.activated/deactivated audit commit together; the agency/membership composite FK prevents cross-agency attribution. Direct writes and audit visibility remain unchanged. Revocation applies on the next request; future inventory/CRM/rotation behavior is outside this increment.

### Agency member role changes

The existing member roster offers a shared RHF/Zod Form/Select for other admins/sellers only when the current actor is an agency superadmin. `set_agency_member_role` independently verifies the active owner and agency, prohibits self/owner changes and accepts only distinct admin/seller roles. The action derives authority from the current membership; platform assignment or submitted metadata grants nothing. Requested role, expected role and expected active state are validated. Stale role or status fails with 40001; inactive members remain inactive, membership UUID/account/other agencies remain unchanged. Fresh document navigation applies current permissions without replacing JWTs or introducing private client cache.

The RPC uses the existing actor SHARE -> agency UPDATE -> target UPDATE NOWAIT order. Conflicts with an inviter holding the target row reject explicitly for reload/retry, avoiding lock cycles. Role mutation plus membership.role_changed audit commit atomically. previous_role/new_role are required, distinct admin/seller values for that action and null for all historical actions; the existing agency/membership composite FK binds attribution. Pending invitations revalidate their author's current role at acceptance, so demotion to seller prevents subsequent grants without silently cancelling their records. No new roles, owner replacement or future inventory/CRM responsibility migration is implemented.

### Agency settings and exchange-rate history

`/panel/agencia?agency=<uuid>` permits active agency admins/superadmins to edit name and ARS/USD rate; slug and active state are read-only in this increment. Current membership and agency are checked by the server and again by `update_agency_settings`. Settings/history queries are named agency adapters, using request-scoped public-key clients under RLS. No browser remote cache or QueryClient is introduced: settings are fresh SSR data, history pagination belongs to the URL and saving reloads the document. Forms reuse shared Form/Input, RHF/Zod and named handlers. Creation/editing share the decimal text schema; queries cast numeric fields to text, preserving precision without JS floating point.

`agency_settings_history` is an immutable record per actual edit, storing author, timestamp, previous/new names and exact numeric rates. A combined record makes name-and-rate edits atomic without duplicating change attribution; a name-only edit explicitly records equal rates. History SELECT requires live agency management membership; platform alone, sellers and other agencies cannot read it. Direct writes are unavailable. The minimal platform audit event agency.settings_updated references the history through an agency/id composite FK; historical audit actions cannot use settings_change_id. State/history/audit commit together and an audit failure rolls all of them back.

`agencies.settings_version` is a server-generated UUID token, initially independent and replaced with the history ID after each real edit. The RPC locks actor SHARE then agency UPDATE, checks the submitted expected version and validates name/decimal input before casting. Concurrent editors produce one winner, and even restoring old values does not revive a stale token. No-op requests create no history. This uses the invitation/membership lock prefix without adding a target membership lock. No rate change rewrites future vehicle base prices; inventory conversion, agency activation, slug/contact editing and hosted deployment are separate work.

### Product rules

- Vehicle publication (draft/published) is separate from availability (available/reserved/sold).
- Reserved vehicles remain in catalog; sold vehicles retain an informational page but leave listings.
- Vehicle creator and seller assignment are separate. A seller creating a vehicle is assigned automatically.
- Prices use decimal values and a base currency ARS/USD. The agency rate is ARS per USD, positive, with actor/timestamp history. Display rounding is not used for financial storage.
- Vehicle images: 1,000,000 bytes; logo: 500,000 bytes; max 12 vehicle images. Dimensions: 4096 per side, logo 2048. JPEG/PNG/WebP, static only. Server validates actual bytes and dimensions before permanent storage. MB/KB use decimal units consistently.
- Contact submission atomically creates inquiry and selects an eligible seller. Per-vehicle rotation advances only for general inquiries. An explicit eligible seller bypasses rotation; no sellers routes to agency inbox.
- Idempotency keys identify submissions; retries cannot consume another rotation turn. Concurrent calls serialize on per-vehicle rotation state. Same key with a different payload is rejected. Retry responses must not disclose prior contact details.
- A contact can have multiple inquiries within an agency. Sellers see only contact details required for assigned inquiries, never all related inquiries.
- Stages: new/contacted/follow_up/won/lost. Visits and tasks are independent. Won does not automatically sell inventory.
- Historical events retain attribution; reassignment never rewrites history. Vehicle visits are shared vehicle metrics, not duplicated seller conversions.

## ADR-001: shared application, separate experiences

Accepted: public routes /agencias/[slug], private /panel and platform /plataforma. A route resolver isolates tenant lookup for future domains. One initial template; no customer forks. Benefit: shared updates. Cost: tenant isolation is a first-class testing responsibility.

## ADR-002: Supabase before a separate API service

Accepted: use managed backend primitives and explicit domain contracts. A separate Node service is deferred until measured workload/integrations justify it. This is not a promise of automatic migration: SQL transactions and RLS remain database-specific assets.

## ADR-003: incremental dependencies and skills

Accepted: install tools when used; do not install every future chart/form package during foundations. Skills are optional reviewed workflow instructions, never a security boundary or replacement for tests.
