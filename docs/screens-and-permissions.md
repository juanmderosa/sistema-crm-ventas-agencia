# Screens and permissions

## Screen map

Implemented authentication/access: `/login` accepts existing email/password accounts; `/cuenta` validates the session, displays the account email and allows logout. `/recuperar` and `/recuperar/confirmar` implement password recovery. `/panel` resolves enabled agency access, offers a selector when needed and displays only the actual user, agency and role. `/plataforma` independently verifies its active assignment and links to agency administration. `/plataforma/agencias` lists agencies with pagination; `/plataforma/agencias/nueva` creates an active agency and records its author atomically. The agency superadministrator route assigns an initial owner from existing profiles with an audited membership. The platform invitation route creates new invited Auth identities through an authenticated Edge Function; the recipient sets a password and accepts before receiving the agency role. Member listing and audited activation/deactivation are available in the agency management area; owner-authorized admin/seller role changes are also available. The account page grants no agency access. The table describes the target product.

| Route                           | Audience                 | Planned content                                                     |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| /                               | Public                   | Foundation status initially; product entry later                    |
| /agencias/[slug]                | Public                   | Agency identity, catalog, URL filters and pagination                |
| /agencias/[slug]/vehiculos/[id] | Public                   | Published details, photos, prices, seller contact and visit request |
| /login                          | Internal users           | Email/password login, recovery, explicit error states               |
| /panel                          | Authenticated membership | Agency overview and permitted metrics                               |
| /panel/vehiculos                | Authorized team          | Inventory, edit/new, photos, availability and publication           |
| /panel/crm                      | Authorized team          | Inquiry list/detail, notes, tasks, owner and stage                  |
| /panel/visitas                  | Authorized team          | Requests, confirmation and follow-up                                |
| /panel/estadisticas             | Authorized team          | Date/seller filters with permission-aware results                   |
| /panel/agencia                  | Agency management        | Identity, contact details and rate                                  |
| /panel/usuarios                 | Agency management        | Permitted role creation, assignment and activation                  |
| /plataforma                     | Platform superadmin      | Agency creation, owner assignment, global metrics                   |

Planned routes are not implemented placeholders and must not be represented as working. `/panel/usuarios?agency=<uuid>` now implements agency admin/seller invitations, paginated status and cancellation; `/invitaciones/usuarios/aceptar` handles new and existing accounts. Platform access by itself does not authorize agency user management; an explicit active agency management membership is required. `/panel/usuarios/miembros?agency=<uuid>` lists members and implements audited deactivation/reactivation with owner/self protection. Owners manage admins/sellers; admins only sellers. Only the agency superadmin can change other admin/seller roles, preserving active state and other agencies; own membership and all superadmins are protected.

## Permission matrix

Platform superadmin can access all agencies. Other roles are scoped to active agency membership.

| Operation                         | Agency superadmin | Admin      | Seller                             |
| --------------------------------- | ----------------- | ---------- | ---------------------------------- |
| Edit agency / exchange rate       | Yes               | Yes        | No                                 |
| Create agency admins              | Yes               | No         | No                                 |
| Create/deactivate sellers         | Yes               | Yes        | No                                 |
| Create vehicle                    | Yes               | Yes        | Yes, automatically assigned        |
| Edit/publish/reserve/sell vehicle | All agency        | All agency | Assigned only                      |
| Assign vehicle sellers            | Yes               | Yes        | No                                 |
| Read/update inquiries             | All agency        | All agency | Responsible only                   |
| Reassign inquiries                | Yes               | Yes        | No                                 |
| Metrics                           | All agency        | All agency | Own; vehicle visits labeled shared |
| Agency/platform creation          | No                | No         | No                                 |

Self role escalation and editing another agency are forbidden regardless of UI. Membership deactivation revokes access and excludes the seller from new rotation; existing inquiries remain visible to management for reassignment.
