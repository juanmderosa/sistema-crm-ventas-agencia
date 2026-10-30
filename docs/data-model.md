# Data model

## Agency activity state

`agencies.status_version` is an independent optimistic-edit UUID, initially generated and rotated for every platform activation/deactivation. It does not replace settings_version. `audit_events.previous_is_active`/new_is_active are required matching false/true for agency.activated and true/false for agency.deactivated; other actions require both null. Those events have no invitation/member/settings target. The agency row and audit are updated together, leaving all membership rows unchanged; effective access still requires both the agency and membership to be active.

## Agency settings history

`agencies.settings_version` is an optimistic-edit UUID, generated initially and replaced with the new change record ID after an edit. `agency_settings_history` stores agency/actor foreign keys, previous/new names, previous/new numeric(18,6) positive rates and created_at, indexed by agency/date/id and actor. Name or rate must actually change. Its agency/id unique pair supports audit_events.settings_change_id as a composite FK. agency.settings_updated requires that reference and no membership/invitation/target reference; older actions cannot use it. Name-only edits retain equal rates explicitly. History is management-readable within its agency and client-immutable; current configuration and history/audit are updated atomically with a version guard. The full-product rate_history design is realized here as combined settings history, keeping a single author/transaction for simultaneous name/rate changes.

## Role change audit (2026-10-30)

`audit_events.previous_role` and `new_role` are required distinct admin/seller values only for membership.role_changed, and null for all other audit actions. The existing agency/membership composite FK and separate actor/target attribution remain authoritative. Role changes update only memberships.role, preserving identity, active state and other agency memberships. Initial-owner assignment/replacement is not part of this operation.

## Membership status audit (2026-10-30)

`audit_events.membership_id` uses the existing memberships agency/id unique pair through a composite FK. Only membership.activated/deactivated may use it, with target_user_id required and no invitation references. Historical actions remain compatible and cannot use this column. The guarded roster RPC returns membership identity, linked profile display name, current role/state and creation time; it exposes neither global profiles nor Auth email/password data. Deactivation/reactivation preserves the membership UUID/role and all other agency memberships. There is no account deletion or owner replacement in this increment.

## Agency user invitation contract (2026-10-29)

`agency_user_invitations` implements the employee invitation lifecycle separately from the platform's initial-owner `agency_invitations`. It stores agency/inviter/profile foreign keys, normalized email, display name, fixed admin/seller role, bound recipient, sending/sent/failed/accepted/cancelled state and timestamps (one-hour default expiry). Accepted requires accepted_at; sent/accepted require a bound recipient. The agency/id unique pair supports the audit composite foreign key, preventing cross-agency invitation attribution. Indexes cover agency/date, inviter and recipient.

`audit_events.user_invitation_id` references that pair. New actions user_invitation.sent, user_invitation.cancelled, membership.user_invited and user_invitation.accepted cannot refer to the initial-owner invitation column. Existing actions remain compatible and cannot refer to employee invitations. Audit writes remain guarded, with platform-only reads. RLS and RPC authorization differ from initial-owner provisioning: current agency superadmin can manage admin/seller invitations, admin only seller invitations, and each bound recipient can read its own record. No employee email/UI path is implemented in this database increment. See architecture/testing for mutation, locking and acceptance rules.

The table below remains the design baseline for the complete product. Migration `20261027000000_agencies_roles.sql` implements only agencies, profiles, memberships and platform_admins, verified on local Supabase. Types for the public schema are generated from migrated local Supabase in `src/lib/supabase/database.types.ts`; CI checks for drift. They describe database structure, not permission to execute writes.

## Implemented authorization foundation

Agencies contain UUID, canonical unique slug, name, active state, positive finite numeric ARS/USD rate and creation timestamp. Profiles contain the Auth user ID, display name and creation timestamp; contact fields and automatic Auth provisioning are deferred. Memberships contain UUID, agency/user references, role, active state and creation timestamp, with unique agency/user and agency/id pairs. Platform assignments contain user reference, active state and creation timestamp. Foreign keys restrict deletion rather than silently removing assignments.

All four tables enable RLS. Anonymous clients have no table access. Authenticated clients have SELECT only, including platform administrators; there are no client mutation policies or provisioning endpoints. An active member of an active agency reads that agency and their own membership. Active agency admins/superadmins also read the agency roster, including inactive memberships. Members cannot read other users' profiles; each user can read their own profile even without an active membership. Active platform administrators can read all four tables, including inactive agencies and assignments.

Users can belong to multiple agencies with independent roles. Inactivating an agency or membership removes the access derived from that membership; inactivating a platform assignment removes global access. Checks read current database state rather than user-editable JWT metadata. The two narrowly scoped SECURITY DEFINER helpers live in the unexposed `private` schema, use an empty fixed search_path, and derive the user from auth.uid(). Only authenticated clients receive schema usage/function execution; they cannot supply another user ID or create objects there.

Role management, audited writes, exchange-rate history, public agency projections, login and application authorization adapters are separate increments. The full permission matrix describes the target product, not available write operations in this foundation.

## Platform creation writes

Migration `20261027010000_platform_agency_creation.sql` adds `audit_events` with UUID, agency reference, actor profile reference, action `agency.created` and timestamp. Both references restrict deletion. Its current action constraint intentionally covers only this delivered operation; other audit events remain future schema changes. RLS permits active platform reads only, with no authenticated mutation grants.

The authenticated RPC `create_agency(text,text,text)` checks and locks the caller's active platform assignment, validates canonical slug/name/exact decimal rate, and creates an active agency plus its audit event in one transaction. It cannot accept a client-selected actor or assign memberships. No broader write permissions were added to existing tables. Database types are regenerated from the migrated local instance. The read-only foundation descriptions above describe the original migration; this RPC is the new, narrowly scoped mutation boundary.

## Initial owner assignment

Migration `20261028000000_initial_agency_superadmin.sql` extends audit_events with nullable target_user_id (profile FK with restricted deletion). agency.created requires null; membership.superadmin_assigned requires a target. The latter records the assigned user independently of the actor. The new authenticated RPC validates platform authority and existing target profile, locks the agency, and atomically inserts membership plus event. It does not alter prior memberships or allow replacing active/inactive owner history. No change to the membership table's general role cardinality or legacy data is required; competing calls through this initial-assignment API are serialized per agency.

## Invitation lifecycle

Migrations `20261028010000_superadmin_invitations.sql` and `20261028010100_existing_invitation_profiles.sql` add agency_invitations with agency/author references, normalized email/name, optional bound profile, lifecycle state, expiry and acceptance timestamp. Active platform users read the records; bound recipients read their own. Clients have no mutation grants. audit_events gains an invitation FK and sent/accepted/cancelled actions; all existing audit variants remain valid. Deletions are restricted, preserving references rather than cascading through identities.

Guarded RPCs reserve, cancel and accept invitations under an agency lock. Delivery binding and confirmed existing-account profile preparation are service-only operations used by the administrative Edge adapter. Public acceptance checks the stored user ID, current verified Auth email and configured password; it does not accept actor/role/agency ownership from the recipient. Identity/authority/expiry/state are rechecked on every attempt. A sent invitation grants no membership; acceptance inserts membership/audit and consumes the invitation in one transaction. Existing-profile assignment now blocks pending reservations and unconfirmed targets; its previous SQL fixture identities were marked confirmed to preserve their intended eligible state, without removing prior assertions.

## Planned product entities

| Entity              | Key relationships and invariants                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| agencies            | Unique slug; public identity; active state; positive ARS/USD rate                                                                      |
| profiles            | auth.users ID; display name and internal contact fields, not self-editable roles                                                       |
| platform_admins     | Separate privileged assignment; no public writes                                                                                       |
| memberships         | Unique agency/user; agency_superadmin/admin/seller; active state                                                                       |
| vehicles            | Agency; creator; type; make/model/year; structured features; decimal base price/currency; publication; availability; archive timestamp |
| vehicle_sellers     | Agency + vehicle + active membership relationship; unique assignment                                                                   |
| vehicle_images      | Agency + vehicle; private object path, order, content metadata; max count enforced atomically                                          |
| contacts            | Agency; normalized phone; display name; unique agency/normalized phone                                                                 |
| inquiries           | Agency + contact + vehicle; responsible membership optional; stage; immutable source attribution                                       |
| submission_receipts | Unique scoped idempotency key, payload digest and safe response; restricted access                                                     |
| vehicle_rotations   | Agency + vehicle; serialized rotation state                                                                                            |
| activities          | Agency + inquiry; author, type, timestamp, note; append-only history where appropriate                                                 |
| tasks               | Agency + inquiry; assignee, due time, completion                                                                                       |
| visits              | Agency + inquiry; requested time, confirmed time, status                                                                               |
| rate_history        | Agency; old/new rate; actor; timestamp                                                                                                 |
| audit_events        | Agency optional for platform event; actor; action; target; minimal safe metadata                                                       |
| analytics_events    | Agency; vehicle optional; event type/time; seller attribution when applicable; no phone/name                                           |

Use UUID identifiers and timestamptz instants. Each tenant-owned parent exposes a unique (agency_id, id) pair for composite child foreign keys. Contact reuse is agency-local. Financial values use numeric, not floating-point columns. API dates are ISO 8601, displayed in agency timezone (initial default America/Argentina/Buenos_Aires).

Public projections include only public fields, enforce publication and agency activity, and must not bypass row authorization accidentally through owner-rights views. Each SECURITY DEFINER function requires fixed search_path, explicit authorization, minimal grants and negative tests.

Physical indexes follow query contracts: tenant/filter inventory, tenant/responsible/stage inquiries, tenant/time analytics and due tasks. Do not prematurely store arbitrary business fields in JSON; reserve JSON for bounded configuration/metadata.
