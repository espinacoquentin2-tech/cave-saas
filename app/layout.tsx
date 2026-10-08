import type { Metadata } from "next";
import { getPublicAnalyticsConfig, SITE_DESCRIPTION, SITE_ORIGIN } from "@/lib/site-config";
import { PrivacyControls } from "@/components/public-site/PrivacyControls";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Ma Cuverie - Gestion de cave et de cuverie",
  description: SITE_DESCRIPTION,
  openGraph: { title: "Ma Cuverie", description: SITE_DESCRIPTION, siteName: "Ma Cuverie", locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image", title: "Ma Cuverie", description: SITE_DESCRIPTION },
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
        <PrivacyControls analytics={getPublicAnalyticsConfig()} />
      </body>
    </html>
  );
}
