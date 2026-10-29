import { z } from "zod";
import { recoveryTokenSchema } from "@/features/auth/schemas";
import { AcceptInvitationForm } from "@/features/invitations/components/accept-form";
import { ResumeInvitationButton } from "@/features/invitations/components/resume-button";
import { getCurrentUser } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Aceptar invitación · Concesionarias",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{
    invitation?: string | string[];
    token_hash?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const invitation = z.uuid().safeParse(query.invitation);
  const token = recoveryTokenSchema.safeParse(query.token_hash);
  const user = await getCurrentUser();
  return (
    <main id="main" className="auth-shell">
      <section className="auth-card">
        <h1>Aceptar invitación</h1>
        {!invitation.success ? (
          <p role="alert">El enlace de invitación no es válido.</p>
        ) : (
          <>
            {token.success ? (
              <>
                <p className="auth-description">
                  Definí una contraseña de al menos ocho caracteres. El enlace
                  se valida al guardar.
                </p>
                <AcceptInvitationForm
                  invitationId={invitation.data}
                  token={token.data}
                />
              </>
            ) : query.token_hash !== undefined ? (
              <p role="alert">El enlace está incompleto o fue alterado.</p>
            ) : (
              <p className="auth-description">
                Si ya definiste tu contraseña, ingresá con la cuenta invitada y
                volvé a abrir este enlace para completar la aceptación.
              </p>
            )}
            <nav className="agency-actions">
              <a href={`/invitaciones/aceptar?invitation=${invitation.data}`}>
                Ya definí mi contraseña
              </a>
            </nav>
            {!token.success && user && (
              <ResumeInvitationButton id={invitation.data} />
            )}
          </>
        )}
        <nav className="agency-actions">
          <a href="/login">Ingresar</a>
          <a href="/recuperar">Recuperar contraseña</a>
        </nav>
      </section>
    </main>
  );
}
