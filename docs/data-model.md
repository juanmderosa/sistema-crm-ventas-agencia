# Data model

The table below remains the design baseline for the complete product. Migration `20261027000000_agencies_roles.sql` implements only agencies, profiles, memberships and platform_admins, verified on local Supabase. Database types are not generated yet.

## Implemented authorization foundation

Agencies contain UUID, canonical unique slug, name, active state, positive finite numeric ARS/USD rate and creation timestamp. Profiles contain the Auth user ID, display name and creation timestamp; contact fields and automatic Auth provisioning are deferred. Memberships contain UUID, agency/user references, role, active state and creation timestamp, with unique agency/user and agency/id pairs. Platform assignments contain user reference, active state and creation timestamp. Foreign keys restrict deletion rather than silently removing assignments.

All four tables enable RLS. Anonymous clients have no table access. Authenticated clients have SELECT only, including platform administrators; there are no client mutation policies or provisioning endpoints. An active member of an active agency reads that agency and their own membership. Active agency admins/superadmins also read the agency roster, including inactive memberships. Members cannot read other users' profiles; each user can read their own profile even without an active membership. Active platform administrators can read all four tables, including inactive agencies and assignments.

Users can belong to multiple agencies with independent roles. Inactivating an agency or membership removes the access derived from that membership; inactivating a platform assignment removes global access. Checks read current database state rather than user-editable JWT metadata. The two narrowly scoped SECURITY DEFINER helpers live in the unexposed `private` schema, use an empty fixed search_path, and derive the user from auth.uid(). Only authenticated clients receive schema usage/function execution; they cannot supply another user ID or create objects there.

Role management, audited writes, exchange-rate history, public agency projections, login and application authorization adapters are separate increments. The full permission matrix describes the target product, not available write operations in this foundation.

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
