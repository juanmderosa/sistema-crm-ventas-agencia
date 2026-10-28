import { notFound, redirect } from "next/navigation";
import { AccessShell } from "@/features/access/components/access-shell";
import { CreateAgencyForm } from "@/features/agencies/components/create-agency-form";
import { getPlatformAgencyAccess } from "@/features/agencies/server/authorization";
import { getCurrentUser } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crear agencia · Plataforma" };

export default async function NewAgencyPage() {
  const access = await getPlatformAgencyAccess();
  if (!access) {
    if (!(await getCurrentUser())) redirect("/login");
    notFound();
  }
  return (
    <AccessShell>
      <p className="eyebrow">PLATAFORMA</p>
      <h1>Crear agencia</h1>
      <p className="auth-description">
        La agencia se creará activa y sin usuarios asignados.
      </p>
      <CreateAgencyForm />
      <nav className="agency-actions">
        <a href="/plataforma/agencias">Volver al listado</a>
      </nav>
    </AccessShell>
  );
}
