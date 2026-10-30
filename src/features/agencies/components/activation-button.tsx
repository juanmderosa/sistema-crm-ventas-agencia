"use client";
import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { changeAgencyStatus } from "../server/activation-actions";
export function AgencyActivationButton({
  agencyId,
  isActive,
  version,
}: {
  agencyId: string;
  isActive: boolean;
  version: string;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function handleChange() {
    setPending(true);
    setError(undefined);
    try {
      const result = await changeAgencyStatus({
        agencyId,
        isActive: !isActive,
        expectedVersion: version,
      });
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.reload();
    } catch {
      setError(
        "No pudimos confirmar el cambio. Recargá el listado para comprobar el estado.",
      );
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="auth-button"
        disabled={!hydrated || pending}
        onClick={handleChange}
      >
        {pending
          ? "Guardando…"
          : isActive
            ? "Desactivar agencia"
            : "Reactivar agencia"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  );
}
