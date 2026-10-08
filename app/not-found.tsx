import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <p className="not-found-brand">Ma Cuverie</p>
      <p className="not-found-code">404</p>
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page. Retrouvez Ma Cuverie depuis l&apos;accueil.</p>
      <Link href="/">Retour à l&apos;accueil</Link>
    </main>
  );
}
