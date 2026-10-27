# Initial logical data model (not a deployed schema)

This is the migration design baseline. No SQL migration or generated database types are claimed in stage 0. Introduce executable schema alongside real RLS tests in stage 1.

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
