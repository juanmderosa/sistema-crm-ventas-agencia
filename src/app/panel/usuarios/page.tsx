import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/server/session";
import { AccessShell } from "@/features/access/components/access-shell";
import { roleLabels } from "@/features/access/domain";
import { getAgencyUserManagementAccess } from "@/features/user-invitations/server/authorization";
import { listAgencyUserInvitations } from "@/features/user-invitations/server/queries";
import { AgencyUserInviteForm } from "@/features/user-invitations/components/invite-form";
import { CancelInvitationButton } from "@/features/invitations/components/cancel-button";
import { invitationStatusLabels } from "@/features/invitations/schemas";
export const dynamic = "force-dynamic";
export const metadata = { title: "Invitar usuarios · Concesionarias" };
export default async function AgencyUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    agency?: string | string[];
    page?: string | string[];
  }>;
}) {
  if (!(await getCurrentUser())) redirect("/login");
  const query = await searchParams;
  const access = await getAgencyUserManagementAccess(query.agency);
  if (!access) notFound();
  const page = z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .optional()
    .transform((value) => Number(value ?? 1))
    .safeParse(query.page);
  if (!page.success) notFound();
  const invitations = await listAgencyUserInvitations(
    access.client,
    access.membership.agency.id,
    page.data,
  );
  const agency = access.membership.agency;
  return (
    <AccessShell>
      <p className="eyebrow">USUARIOS DE AGENCIA</p>
      <h1>Invitar usuarios</h1>
      <h2 className="access-agency-name">{agency.name}</h2>
      <p className="auth-description">
        Las cuentas nuevas definen una contraseña al aceptar. Las existentes
        conservan su contraseña. El acceso se habilita después de aceptar.
      </p>
      <AgencyUserInviteForm
        agencyId={agency.id}
        canInviteAdmins={access.membership.role === "agency_superadmin"}
      />
      <h2 className="access-agency-name">Invitaciones</h2>
      <p>Se muestran las invitaciones de los roles que podés administrar.</p>
      {invitations.rows.length === 0 && (
        <p>No hay invitaciones en esta página.</p>
      )}
      <ul className="platform-agencies">
        {invitations.rows.map((row) => (
          <li key={row.id}>
            <h3>{row.display_name}</h3>
            <p>{row.email}</p>
            <p>{roleLabels[row.role]}</p>
            <p>
              Estado:{" "}
              {row.isExpired && ["sending", "sent"].includes(row.status)
                ? "Vencida"
                : invitationStatusLabels[row.status]}
            </p>
            {["sending", "sent"].includes(row.status) && (
              <CancelInvitationButton
                id={row.id}
                agencyId={agency.id}
                kind="agency-user"
              />
            )}
          </li>
        ))}
      </ul>
      <nav className="agency-actions" aria-label="Paginación de invitaciones">
        {page.data > 1 && (
          <a href={`/panel/usuarios?agency=${agency.id}&page=${page.data - 1}`}>
            Anterior
          </a>
        )}
        {invitations.hasNext && (
          <a href={`/panel/usuarios?agency=${agency.id}&page=${page.data + 1}`}>
            Siguiente
          </a>
        )}
      </nav>
      <a href={`/panel?agency=${agency.id}`}>Volver al panel</a>
    </AccessShell>
  );
}
