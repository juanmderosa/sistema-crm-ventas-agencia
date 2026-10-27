import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ingresar · Concesionarias" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/panel");
  return (
    <main id="main" className="auth-shell">
      <Link href="/" className="auth-brand">
        C. / Concesionarias
      </Link>
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">ACCESO AL SISTEMA</p>
        <h1 id="login-title">Ingresar</h1>
        <p className="auth-description">
          Usá el correo y la contraseña de tu cuenta habilitada.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
