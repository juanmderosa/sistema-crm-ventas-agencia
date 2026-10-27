import type { ReactNode } from "react";
import { LogoutButton } from "@/features/auth/components/logout-button";

export function AccessShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="access-shell">
      <header className="access-header">
        <a href="/panel" className="auth-brand">
          C. / Concesionarias
        </a>
        <nav aria-label="Cuenta">
          <a href="/cuenta">Mi cuenta</a>
          <LogoutButton />
        </nav>
      </header>
      <section className="auth-card">{children}</section>
    </main>
  );
}
