import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ma Cuverie",
  description: "Gestion de cave, lots, cuverie et traçabilité",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
