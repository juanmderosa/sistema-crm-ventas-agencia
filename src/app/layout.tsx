import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concesionarias · Base del proyecto",
  description: "Fundaciones del sistema de gestión para concesionarias.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
