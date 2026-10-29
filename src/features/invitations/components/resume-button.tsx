"use client";
import { useState } from "react";
import { resumeInvitation } from "../server/actions";
import {
  resumeAgencyUserInvitation,
  acceptExistingAgencyUserInvitation,
} from "@/features/user-invitations/server/actions";
import { useHydrated } from "@/lib/use-hydrated";

export function ResumeInvitationButton({
  id,
  kind = "superadmin",
  token,
}: {
  id: string;
  kind?: "superadmin" | "agency-user";
  token?: string;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function handleResume() {
    setPending(true);
    setError(undefined);
    try {
      const result =
        kind === "agency-user"
          ? token
            ? await acceptExistingAgencyUserInvitation({
                invitationId: id,
                token,
              })
            : await resumeAgencyUserInvitation(id)
          : await resumeInvitation(id);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.replace(token ? "/login?invited=1" : "/panel");
    } catch {
      setError(
        "No pudimos completar la aceptación. Recargá y revisá tu acceso.",
      );
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="auth-button"
        disabled={!hydrated || pending}
        onClick={handleResume}
      >
        {pending
          ? "Completando…"
          : token
            ? "Aceptar invitación"
            : "Completar aceptación con mi sesión"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  );
}
