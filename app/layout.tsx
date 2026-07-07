import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ma Cuverie - Gestion de cave et de cuverie",
  description: "Logiciel de gestion de cave, cuverie, lots, stocks, analyses, dégustations et traçabilité pour domaines, maisons et caves.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
