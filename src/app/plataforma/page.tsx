import { notFound } from "next/navigation";
import { getAccessContext } from "@/features/access/server/context";
import { AccessShell } from "@/features/access/components/access-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma · Concesionarias" };

export default async function PlatformPage() {
  const context = await getAccessContext();
  if (!context.isPlatformAdmin) notFound();
  return (
    <AccessShell>
      <p className="eyebrow">PLATAFORMA</p>
      <h1>Acceso de plataforma</h1>
      <dl className="access-details">
        <div>
          <dt>Usuario</dt>
          <dd>{context.user.email}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>Administrador de plataforma</dd>
        </div>
      </dl>
      {context.memberships.length > 0 && (
        <>
          <h2>Mis agencias</h2>
          <ul className="agency-choices">
            {context.memberships.map(({ agency }) => (
              <li key={agency.id}>
                <a href={`/panel?agency=${agency.id}`}>{agency.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </AccessShell>
  );
}
