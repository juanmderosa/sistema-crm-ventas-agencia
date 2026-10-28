"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="auth-shell">
      <section className="auth-card">
        <h1>No pudimos completar la solicitud</h1>
        <p className="auth-description">
          Intentá nuevamente en unos instantes.
        </p>
        <button className="auth-button" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}
