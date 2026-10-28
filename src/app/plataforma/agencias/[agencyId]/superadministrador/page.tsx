import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { AccessShell } from "@/features/access/components/access-shell";
import { getCurrentUser } from "@/features/auth/server/session";
import { getPlatformAgencyAccess } from "@/features/agencies/server/authorization";
import {
  getAgencyAssignment,
  listAssignmentProfiles,
} from "@/features/agencies/server/assignment-queries";
import { AssignSuperadminForm } from "@/features/agencies/components/assign-superadmin-form";
import { agencyPageSchema } from "@/features/agencies/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Superadministrador · Agencia" };

export default async function AgencySuperadminPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
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

  const page = agencyPageSchema.safeParse((await searchParams).page);
  if (!page.success)
    return (
      <AccessShell>
        <h1>Superadministrador</h1>
        <p role="alert">La página de usuarios no es válida.</p>
        <a href={`/plataforma/agencias/${id.data}/superadministrador`}>
          Volver
        </a>
      </AccessShell>
    );

  const choices =
    agency.is_active && owners.length === 0
      ? await listAssignmentProfiles(access.client, page.data)
      : null;

  const base = `/plataforma/agencias/${id.data}/superadministrador`;
  return (
    <AccessShell>
      <p className="eyebrow">PLATAFORMA</p>
      <h1>Superadministrador de agencia</h1>
      <h2 className="access-agency-name">{agency.name}</h2>
      {owners.length > 0 ? (
        <>
          <p role="status">
            La agencia ya tiene una asignación de superadministrador.
          </p>
          <ul>
            {owners.map((owner) => (
              <li key={owner.user_id}>
                {owner.profile.display_name} — {owner.user_id} —{" "}
                {owner.is_active ? "Activo" : "Inactivo"}
              </li>
            ))}
          </ul>
        </>
      ) : !agency.is_active ? (
        <p role="status">
          La agencia está inactiva. No se puede asignar un responsable.
        </p>
      ) : (
        choices && (
          <>
            <p className="auth-description">
              Seleccioná el superadministrador inicial. Esta operación no
              reemplaza ni modifica membresías existentes.
            </p>
            {choices.profiles.length > 0 ? (
              <AssignSuperadminForm
                agencyId={id.data}
                profiles={choices.profiles}
              />
            ) : (
              <p>No hay usuarios con perfil en esta página.</p>
            )}
            <nav className="agency-actions" aria-label="Páginas de usuarios">
              {page.data > 1 && (
                <a href={`${base}?page=${page.data - 1}`}>
                  Usuarios anteriores
                </a>
              )}
              {choices.hasMore && (
                <a href={`${base}?page=${page.data + 1}`}>Más usuarios</a>
              )}
            </nav>
          </>
        )
      )}
      <nav className="agency-actions">
        <a href="/plataforma/agencias">Volver a agencias</a>
      </nav>
    </AccessShell>
  );
}
