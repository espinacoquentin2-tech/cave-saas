import MaCuverieApp from "@/components/MaCuverieApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace connecté — Ma Cuverie",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return <MaCuverieApp />;
}
