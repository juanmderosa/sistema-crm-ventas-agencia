"use client";
import { useState } from "react";
import { resumeInvitation } from "../server/actions";
import { useHydrated } from "@/lib/use-hydrated";

export function ResumeInvitationButton({ id }: { id: string }) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function handleResume() {
    setPending(true);
    setError(undefined);
    try {
      const result = await resumeInvitation(id);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.replace("/panel");
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
        {pending ? "Completando…" : "Completar aceptación con mi sesión"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  );
}
