"use client";
import { useState } from "react";
import { cancelInvitation } from "../server/actions";
import { useHydrated } from "@/lib/use-hydrated";

export function CancelInvitationButton({
  id,
  agencyId,
}: {
  id: string;
  agencyId: string;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function handleCancel() {
    setPending(true);
    setError(undefined);
    try {
      const result = await cancelInvitation(id);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.replace(`/plataforma/agencias/${agencyId}/invitar`);
    } catch {
      setError(
        "No pudimos confirmar la cancelación. Recargá para revisar el estado.",
      );
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="auth-button"
        disabled={!hydrated || pending}
        onClick={handleCancel}
      >
        {pending ? "Cancelando…" : "Cancelar invitación"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  );
}
