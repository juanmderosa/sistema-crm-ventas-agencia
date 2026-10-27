import Link from "next/link";
import { RecoveryPasswordForm } from "@/features/auth/components/recovery-password-form";
import { recoveryTokenSchema } from "@/features/auth/schemas";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Nueva contraseña · Concesionarias",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConfirmRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[] }>;
}) {
  const parsed = recoveryTokenSchema.safeParse((await searchParams).token_hash);
  return (
    <main id="main" className="auth-shell">
      <section className="auth-card">
        <h1>Nueva contraseña</h1>
        {parsed.success ? (
          <>
            <p className="auth-description">
              Usá al menos ocho caracteres. El enlace se valida al guardar y
              sirve una sola vez.
            </p>
            <RecoveryPasswordForm token={parsed.data} />
          </>
        ) : (
          <p role="alert">
            El enlace es inválido o está incompleto. Solicitá uno nuevo.
          </p>
        )}
        <Link href="/recuperar">Solicitar otro enlace</Link>
      </section>
    </main>
  );
}
