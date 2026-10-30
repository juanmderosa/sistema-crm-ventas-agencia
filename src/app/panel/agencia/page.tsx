import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/session";
import { getAgencyUserManagementAccess } from "@/features/user-invitations/server/authorization";
import {
  getAgencySettings,
  listAgencySettingsHistory,
} from "@/features/agencies/server/settings-queries";
import { agencyPageSchema } from "@/features/agencies/schemas";
import { AgencySettingsForm } from "@/features/agencies/components/settings-form";
import { AccessShell } from "@/features/access/components/access-shell";
export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración de agencia · Concesionarias" };
export default async function AgencySettingsPage({
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
  const page = agencyPageSchema.safeParse(query.page);
  if (!access || !page.success) notFound();
  const agencyId = access.membership.agency.id;
  const [settings, history] = await Promise.all([
    getAgencySettings(access.client, agencyId),
    listAgencySettingsHistory(access.client, agencyId, page.data),
  ]);
  if (!settings) notFound();
  return (
    <AccessShell>
      <p className="eyebrow">AGENCIA</p>
      <h1>Configuración de agencia</h1>
      <h2 className="access-agency-name">{settings.name}</h2>
      <p className="auth-description">
        Identificador público: {settings.slug}. El nombre y la cotización se
        guardan con historial. Un cambio de cotización no modifica precios
        guardados de vehículos.
      </p>
      <AgencySettingsForm
        values={{
          agencyId,
          expectedVersion: settings.settings_version,
          name: settings.name,
          arsPerUsd: settings.ars_per_usd,
        }}
      />
      <h2 className="access-agency-name">Historial de cambios</h2>
      <p>
        Fechas en horario de Argentina. Las cotizaciones se muestran con su
        precisión original.
      </p>
      {history.rows.length === 0 && <p>No hay cambios en esta página.</p>}
      <ul className="platform-agencies">
        {history.rows.map((row) => (
          <li key={row.id}>
            <p>Autor: {row.actor_id}</p>
            <p>
              <time dateTime={row.created_at}>
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Argentina/Buenos_Aires",
                }).format(new Date(row.created_at))}
              </time>
            </p>
            <p>Nombre anterior: {row.previous_name}</p>
            <p>Nombre nuevo: {row.new_name}</p>
            <p>Cotización anterior: {row.previous_ars_per_usd} ARS por USD</p>
            <p>Cotización nueva: {row.new_ars_per_usd} ARS por USD</p>
          </li>
        ))}
      </ul>
      <nav className="agency-actions" aria-label="Paginación del historial">
        {page.data > 1 && (
          <a href={`/panel/agencia?agency=${agencyId}&page=${page.data - 1}`}>
            Anterior
          </a>
        )}
        {history.hasNext && (
          <a href={`/panel/agencia?agency=${agencyId}&page=${page.data + 1}`}>
            Siguiente
          </a>
        )}
      </nav>
      <a href={`/panel?agency=${agencyId}`}>Volver al panel</a>
    </AccessShell>
  );
}
