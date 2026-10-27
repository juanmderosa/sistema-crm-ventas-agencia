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

## State ownership

Public server-rendered data is not automatically copied into a client cache. Panel query keys begin with private/userId/agencyId. Session change must clear QueryClient before rendering another identity. Filters, sort and pagination live in URL search parameters. Form state stays in React Hook Form. Local modals and transient selection stay in React state. No Redux/Zustand initially.

## Security boundaries

Agency is resolved from public route or an authenticated membership; a supplied agency ID is never proof of access. Composite foreign keys bind child and parent to the same agency. RLS applies to every business table; private Storage policies bind objects to an authorized vehicle or agency. Role creation/update is privileged, audited and cannot be accomplished by editing a profile.

Public access exposes a limited projection of published vehicles and public agency/seller fields. Internal notes, contact data and drafts never belong to public responses. Draft image URLs must not become reusable public object URLs. Published media access and revocation are tested before inventory is accepted.

## Business decisions

### Authentication foundation

Email/password authentication uses Supabase Auth through Server Actions and request-scoped `@supabase/ssr` clients. React Hook Form owns the login form and the shared Zod schema validates both browser input and untrusted action arguments. `server-only` protects infrastructure imports. These dependencies are introduced here because the functionality now uses them; versions and lockfile are exact. No dependency upgrade or change to the OpenNext/glob decisions is part of this increment.

Next.js Proxy validates/refreshes the session on `/login` and `/cuenta` and forwards updated cookies and cache headers. Each account render independently validates the user with Auth `getUser()`. A verified identity is not proof of agency access: `/cuenta` exposes only the authenticated user's email and logout. Agency context, `/panel` and `/plataforma` are deferred to the next increment and must consult authoritative active assignments under RLS.

There is no browser Supabase client or private QueryClient in this increment. Auth cookies are HttpOnly, SameSite=Lax and Secure for production HTTPS Supabase configurations; local HTTP is development-only. Login/logout navigate to a new document to discard any prior client memory. Logout uses local scope (this browser session), not global device logout. Private routes are dynamic and carry `private, no-store` cache headers, including cookie refresh responses. Public configuration is validated at server runtime so tests/deployments can provide their own API URL and public key; privileged keys are rejected. Cloudflare runtime configuration still needs its environment bindings configured and verified before pilot.

The global Auth signup switch remains off. With CLI 2.122.0 the local email flag must be on to enable the password provider; E2E checks verify password login succeeds while public signup remains rejected. Local configuration changes require a data-preserving Supabase restart, never a reset.

Reference: [Supabase SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [session/cache behavior](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

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
