"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { logout } from "../server/actions";

export function LogoutButton() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleLogout() {
    setPending(true);
    setError(undefined);
    try {
      const result = await logout();
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.replace("/login");
    } catch {
      setError(
        "No pudimos conectar para cerrar la sesión. Intentá nuevamente.",
      );
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="auth-button"
        disabled={!hydrated || pending}
        onClick={handleLogout}
      >
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
