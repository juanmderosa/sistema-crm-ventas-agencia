import { notFound, redirect } from "next/navigation";
import { AccessShell } from "@/features/access/components/access-shell";
import { getPlatformAgencyAccess } from "@/features/agencies/server/authorization";
import { listPlatformAgencies } from "@/features/agencies/server/queries";
import { agencyPageSchema } from "@/features/agencies/schemas";
import { getCurrentUser } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agencias · Plataforma" };

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const access = await getPlatformAgencyAccess();
  if (!access) {
    if (!(await getCurrentUser())) redirect("/login");
    notFound();
  }
  const page = agencyPageSchema.safeParse((await searchParams).page);
  if (!page.success)
    return (
      <AccessShell>
        <h1>Agencias</h1>
        <p role="alert">La página solicitada no es válida.</p>
        <a href="/plataforma/agencias">Volver al listado</a>
      </AccessShell>
    );
  const { agencies, hasMore } = await listPlatformAgencies(
    access.client,
    page.data,
  );
  return (
    <AccessShell>
      <p className="eyebrow">PLATAFORMA</p>
      <h1>Agencias</h1>
      <nav className="agency-actions" aria-label="Administración de agencias">
        <a href="/plataforma/agencias/nueva">Crear agencia</a>
        <a href="/plataforma">Volver a plataforma</a>
      </nav>
      {agencies.length === 0 ? (
        <p>No hay agencias en esta página.</p>
      ) : (
        <ul className="platform-agencies">
          {agencies.map((agency) => (
            <li key={agency.id}>
              <h2>{agency.name}</h2>
              <a href={`/plataforma/agencias/${agency.id}/superadministrador`}>
                Superadministrador
              </a>
              <dl className="access-details">
                <div>
                  <dt>Identificador</dt>
                  <dd>{agency.slug}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{agency.is_active ? "Activa" : "Inactiva"}</dd>
                </div>
                <div>
                  <dt>ARS por USD</dt>
                  <dd>{agency.ars_per_usd}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      <nav className="agency-actions" aria-label="Páginas de agencias">
        {page.data > 1 && (
          <a href={`/plataforma/agencias?page=${page.data - 1}`}>Anterior</a>
        )}
        {hasMore && (
          <a href={`/plataforma/agencias?page=${page.data + 1}`}>Siguiente</a>
        )}
      </nav>
    </AccessShell>
  );
}
