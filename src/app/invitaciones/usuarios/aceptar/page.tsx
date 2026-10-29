import { z } from "zod";
import { recoveryTokenSchema } from "@/features/auth/schemas";
import { getCurrentUser } from "@/features/auth/server/session";
import { AcceptInvitationForm } from "@/features/invitations/components/accept-form";
import { ResumeInvitationButton } from "@/features/invitations/components/resume-button";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Aceptar invitación de agencia · Concesionarias",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function AcceptAgencyUserPage({
  searchParams,
}: {
  searchParams: Promise<{
    invitation?: string | string[];
    token_hash?: string | string[];
    method?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const id = z.uuid().safeParse(query.invitation);
  const token = recoveryTokenSchema.safeParse(query.token_hash);
  const method = z
    .enum(["invite", "magiclink"])
    .default("invite")
    .safeParse(query.method);
  const user = await getCurrentUser();
  return (
    <main id="main" className="auth-shell">
      <section className="auth-card">
        <h1>Aceptar invitación de agencia</h1>
        {!id.success ||
        !method.success ||
        (query.token_hash !== undefined && !token.success) ? (
          <p role="alert">El enlace de invitación no es válido.</p>
        ) : (
          <>
            {token.success ? (
              method.data === "magiclink" ? (
                <>
                  <p className="auth-description">
                    Aceptá con la cuenta que recibió este correo. Tu contraseña
                    se conserva. Luego ingresá para trabajar.
                  </p>
                  <ResumeInvitationButton
                    id={id.data}
                    kind="agency-user"
                    token={token.data}
                  />
                </>
              ) : (
                <>
                  <p className="auth-description">
                    Definí una contraseña de al menos ocho caracteres para
                    aceptar.
                  </p>
                  <AcceptInvitationForm
                    invitationId={id.data}
                    token={token.data}
                    kind="agency-user"
                  />
                </>
              )
            ) : (
              <>
                <p className="auth-description">
                  Ingresá con la cuenta invitada para completar la aceptación.
                  Si tu cuenta aún no tiene contraseña, usá Recuperar
                  contraseña.
                </p>
                {user && (
                  <ResumeInvitationButton id={id.data} kind="agency-user" />
                )}
              </>
            )}
            <nav className="agency-actions">
              <a href={`/invitaciones/usuarios/aceptar?invitation=${id.data}`}>
                Completar con mi sesión
              </a>
            </nav>
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
