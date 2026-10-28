import { requireUser } from "@/features/auth/server/session";
import { LogoutButton } from "@/features/auth/components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi cuenta · Concesionarias" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main id="main" className="auth-shell">
      <p className="auth-brand">C. / Concesionarias</p>
      <section className="auth-card" aria-labelledby="account-title">
        <p className="eyebrow">SESIÓN INICIADA</p>
        <h1 id="account-title">Mi cuenta</h1>
        <p className="auth-description">{user.email}</p>
        <p>
          <a href="/panel">Ir a mis accesos</a>
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}
