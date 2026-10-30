import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/server/session";
import { getAgencyUserManagementAccess } from "@/features/user-invitations/server/authorization";
import { listAgencyMembers } from "@/features/members/server/queries";
import { canManageMember } from "@/features/members/schemas";
import { MemberStatusButton } from "@/features/members/components/status-button";
import { MemberRoleForm } from "@/features/members/components/role-form";
import { roleLabels } from "@/features/access/domain";
import { AccessShell } from "@/features/access/components/access-shell";
export const dynamic = "force-dynamic";
export const metadata = { title: "Miembros de agencia · Concesionarias" };
export default async function MembersPage({
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
  const page = z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .optional()
    .transform((value) => Number(value ?? 1))
    .safeParse(query.page);
  if (!access || !page.success) notFound();
  const members = await listAgencyMembers(
    access.client,
    access.membership.agency.id,
    page.data,
  );
  const actorRole = access.membership.role;
  if (actorRole !== "agency_superadmin" && actorRole !== "admin") notFound();
  const agencyId = access.membership.agency.id;
  return (
    <AccessShell>
      <p className="eyebrow">USUARIOS DE AGENCIA</p>
      <h1>Miembros de agencia</h1>
      <h2 className="access-agency-name">{access.membership.agency.name}</h2>
      <p className="auth-description">
        Desactivar quita el acceso a esta agencia en la próxima solicitud. La
        cuenta y los accesos a otras agencias se conservan. Reactivar restaura
        el mismo rol. Tu propia membresía y los superadministradores están
        protegidos.
      </p>
      {members.rows.length === 0 && <p>No hay miembros en esta página.</p>}
      <ul className="platform-agencies">
        {members.rows.map((member) => (
          <li key={member.id}>
            <h3>{member.display_name}</h3>
            <p>Identificador de usuario: {member.user_id}</p>
            <p>{roleLabels[member.role]}</p>
            <p>Estado: {member.is_active ? "Activo" : "Inactivo"}</p>
            {canManageMember(actorRole, access.user.id, member) ? (
              <MemberStatusButton
                agencyId={agencyId}
                membershipId={member.id}
                isActive={member.is_active}
              />
            ) : (
              <p>
                {member.user_id === access.user.id
                  ? "Tu membresía"
                  : "Sin permiso para cambiar este miembro"}
              </p>
            )}
            {actorRole === "agency_superadmin" &&
              member.user_id !== access.user.id &&
              (member.role === "admin" || member.role === "seller") && (
                <MemberRoleForm
                  agencyId={agencyId}
                  membershipId={member.id}
                  role={member.role}
                  isActive={member.is_active}
                />
              )}
          </li>
        ))}
      </ul>
      <nav className="agency-actions" aria-label="Paginación de miembros">
        {page.data > 1 && (
          <a
            href={`/panel/usuarios/miembros?agency=${agencyId}&page=${page.data - 1}`}
          >
            Anterior
          </a>
        )}
        {members.hasNext && (
          <a
            href={`/panel/usuarios/miembros?agency=${agencyId}&page=${page.data + 1}`}
          >
            Siguiente
          </a>
        )}
      </nav>
      <nav className="agency-actions">
        <a href={`/panel/usuarios?agency=${agencyId}`}>Invitar usuarios</a>
        <a href={`/panel?agency=${agencyId}`}>Volver al panel</a>
      </nav>
    </AccessShell>
  );
}
