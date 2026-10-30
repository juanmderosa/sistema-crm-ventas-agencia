import { redirect } from "next/navigation";
import { getAccessContext } from "@/features/access/server/context";
import { resolveAgencyAccess, roleLabels } from "@/features/access/domain";
import { AccessShell } from "@/features/access/components/access-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso a agencias · Concesionarias" };

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string | string[] }>;
}) {
  const { agency } = await searchParams;
  const context = await getAccessContext();
  if (agency === undefined && context.isPlatformAdmin) redirect("/plataforma");
  const access = resolveAgencyAccess(context.memberships, agency);

  return (
    <AccessShell>
      <p className="eyebrow">ACCESO A AGENCIAS</p>
      {access.kind === "none" && (
        <>
          <h1>Sin acceso habilitado</h1>
          <p className="auth-description">
            Tu cuenta no tiene una membresía activa en una agencia habilitada.
            Contactá a quien administra tus accesos.
          </p>
        </>
      )}
      {access.kind === "denied" && (
        <>
          <h1>Acceso no disponible</h1>
          <p className="auth-description">
            No tenés acceso habilitado a esta agencia.
          </p>
          <a href="/panel">Volver al acceso</a>
        </>
      )}
      {access.kind === "choose" && (
        <>
          <h1>Elegí una agencia</h1>
          <p className="auth-description">
            Seleccioná con qué agencia querés trabajar.
          </p>
          <ul className="agency-choices">
            {context.memberships.map(({ agency, role }) => (
              <li key={agency.id}>
                <a
                  href={`/panel?agency=${agency.id}`}
                  aria-label={`Ingresar a ${agency.name}`}
                >
                  <span>{agency.name}</span>
                  <small>{roleLabels[role]}</small>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {access.kind === "agency" && (
        <>
          <h1>Panel de agencia</h1>
          <h2 className="access-agency-name">
            {access.membership.agency.name}
          </h2>
          <dl className="access-details">
            <div>
              <dt>Usuario</dt>
              <dd>{context.user.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{roleLabels[access.membership.role]}</dd>
            </div>
          </dl>
          {context.memberships.length > 1 && (
            <a href="/panel">Cambiar de agencia</a>
          )}
          {["agency_superadmin", "admin"].includes(access.membership.role) && (
            <nav className="agency-actions">
              <a href={`/panel/usuarios?agency=${access.membership.agency.id}`}>
                Administrar invitaciones de usuarios
              </a>
              <a
                href={`/panel/usuarios/miembros?agency=${access.membership.agency.id}`}
              >
                Ver miembros de agencia
              </a>
            </nav>
          )}
        </>
      )}
      {access.kind !== "agency" && (
        <p className="access-identity">{context.user.email}</p>
      )}
    </AccessShell>
  );
}
