import Link from "next/link";

const stages = [
  ["01", "Accesos y agencias", "Roles, identidad y aislamiento de datos."],
  ["02", "Inventario", "Vehículos, fotos, vendedores y publicación."],
  ["03", "Sitio público", "Catálogo, filtros y fichas de vehículos."],
  ["04", "Consultas y CRM", "Asignación, seguimiento, tareas y visitas."],
  [
    "05",
    "Estadísticas y piloto",
    "Métricas verificables y validación en una agencia.",
  ],
];

export default function HomePage() {
  return (
    <div className="shell">
      <header className="masthead">
        <span className="brand">
          C<span className="brand-dot">.</span> / Concesionarias
        </span>
        <div className="masthead-actions">
          <span className="environment">DESARROLLO LOCAL</span>
          <Link href="/login">Ingresar</Link>
        </div>
      </header>
      <main id="main">
        <section className="intro" aria-labelledby="title">
          <p className="eyebrow">ETAPA 00 / FUNDACIONES</p>
          <h1 id="title">
            Una base común.
            <br />
            <span>Cada agencia, su identidad.</span>
          </h1>
          <p className="lead">
            Estamos preparando el sistema de gestión y catálogo público. Esta
            pantalla verifica la aplicación base; todavía no ofrece acceso a
            datos ni funciones comerciales.
          </p>
          <div className="principles">
            <span>Un producto compartido</span>
            <span>Datos aislados por agencia</span>
            <span>Calidad verificable</span>
          </div>
        </section>
        <section className="roadmap" aria-labelledby="roadmap-title">
          <div className="section-heading">
            <h2 id="roadmap-title">Próximas entregas</h2>
            <p>Implementación por funcionalidad</p>
          </div>
          <ol>
            {stages.map(([number, title, description]) => (
              <li key={number}>
                <span className="step-number">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <span className="pending">Pendiente</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer>
        Next.js + Supabase{" "}
        <span>Sin datos de clientes · Sin despliegue público</span>
      </footer>
    </div>
  );
}
