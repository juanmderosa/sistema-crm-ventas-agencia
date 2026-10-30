import { z } from "zod";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/session";
import { getPlatformAgencyAccess } from "@/features/agencies/server/authorization";
import { getAgencyAssignment } from "@/features/agencies/server/assignment-queries";
import { AccessShell } from "@/features/access/components/access-shell";
import { listAgencyInvitations } from "@/features/invitations/server/queries";
import { invitationStatusLabels } from "@/features/invitations/schemas";
import { InviteForm } from "@/features/invitations/components/invite-form";
import { CancelInvitationButton } from "@/features/invitations/components/cancel-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitar responsable · Plataforma" };

export default async function InviteAgencyPage({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const access = await getPlatformAgencyAccess();
  if (!access) {
    if (!(await getCurrentUser())) redirect("/login");
    notFound();
  }
  const id = z.uuid().safeParse((await params).agencyId);
  if (!id.success) notFound();
  const { agency, owners } = await getAgencyAssignment(access.client, id.data);
  if (!agency) notFound();
  const invitations = await listAgencyInvitations(access.client, id.data);
  const pending = invitations.some((row) => row.isPending);
  return (
    <AccessShell>
      <p className="eyebrow">PLATAFORMA</p>
      <h1>Invitar superadministrador</h1>
      <h2 className="access-agency-name">{agency.name}</h2>
      <p className="auth-description">
        Para una cuenta nueva. El destinatario definirá su contraseña y aceptará
        antes de recibir acceso. Si la cuenta ya existe, usá la selección de
        usuarios existentes.
      </p>
      {owners.length > 0 ? (
        <p role="status">La agencia ya tiene un superadministrador asignado.</p>
      ) : !agency.is_active ? (
        <p role="status">La agencia está inactiva.</p>
      ) : pending ? (
        <p role="status">
          Hay una invitación pendiente. Podés cancelarla para liberar la
          asignación inicial.
        </p>
      ) : (
        <InviteForm agencyId={id.data} />
      )}
      <h2 className="access-agency-name">Últimas invitaciones</h2>
      {invitations.length === 0 ? (
        <p>No hay invitaciones.</p>
      ) : (
        <ul className="platform-agencies">
          {invitations.map((row) => (
            <li key={row.id}>
              <p>
                {row.display_name} — {row.email}
              </p>
              <p>
                Estado:{" "}
                {["sending", "sent"].includes(row.status) && row.isExpired
                  ? "Vencida"
                  : invitationStatusLabels[row.status]}
              </p>
              {["sending", "sent"].includes(row.status) && (
                <CancelInvitationButton id={row.id} agencyId={id.data} />
              )}
            </li>
          ))}
        </ul>
      )}
      <nav className="agency-actions">
        <a href={`/plataforma/agencias/${id.data}/superadministrador`}>
          Usuarios existentes y responsable
        </a>
        <a href="/plataforma/agencias">Volver a agencias</a>
      </nav>
    </AccessShell>
  );
}
