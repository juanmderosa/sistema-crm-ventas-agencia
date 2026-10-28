import Link from "next/link";
import { RecoveryEmailForm } from "@/features/auth/components/recovery-email-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Recuperar contraseña · Concesionarias",
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  return (
    <main id="main" className="auth-shell">
      <section className="auth-card">
        <h1>Recuperar contraseña</h1>
        <p className="auth-description">
          Ingresá el correo de tu cuenta para solicitar un enlace.
        </p>
        <RecoveryEmailForm />
        <Link href="/login">Volver a ingresar</Link>
      </section>
    </main>
  );
}
