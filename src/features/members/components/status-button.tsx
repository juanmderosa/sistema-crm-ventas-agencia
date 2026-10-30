"use client";
import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { changeMemberStatus } from "../server/actions";
export function MemberStatusButton({
  agencyId,
  membershipId,
  isActive,
}: {
  agencyId: string;
  membershipId: string;
  isActive: boolean;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function handleChange() {
    setPending(true);
    setError(undefined);
    try {
      const result = await changeMemberStatus({
        agencyId,
        membershipId,
        isActive: !isActive,
        expectedIsActive: isActive,
      });
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.reload();
    } catch {
      setError(
        "No pudimos confirmar el cambio. Recargá para comprobar el estado.",
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
        {pending ? "Guardando…" : isActive ? "Desactivar" : "Reactivar"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  );
}
