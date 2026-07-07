import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ma Cuverie - Gestion de cave et de cuverie",
  description:
    "Logiciel de gestion de cave, cuverie, lots, stocks, analyses, dégustations et traçabilité pour domaines, maisons et caves.",
};

const demoMailto = "mailto:contact@macuverie.fr?subject=Demande%20de%20démo%20Ma%20Cuverie";

const modules = [
  "Cuverie",
  "Lots",
  "Ordres de travail",
  "Stocks & intrants",
  "Analyses",
  "Dégustation",
  "Tirage & bouteilles",
  "Expéditions",
  "Journal d'audit",
];

const solutionItems = [
  "Lots",
  "Contenants",
  "Opérations",
  "Stocks",
  "Analyses",
  "Dégustations",
  "Ordres de travail",
  "Traçabilité",
];

const audiences = [
  "Domaines viticoles",
  "Maisons de Champagne",
  "Caves coopératives",
  "Structures de négoce ou d'élevage",
];

export default function PublicHomePage() {
  return (
    <main data-testid="public-home-page" className="public-home">
      <header className="site-header">
        <Link data-testid="public-brand-title" href="/" className="brand">
          Ma Cuverie
        </Link>
        <nav className="top-nav" aria-label="Navigation principale">
          <a href="#modules">Modules</a>
          <a href="#securite">Sécurité</a>
          <a href="#demo">Démo</a>
          <Link href="/app">Application</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">SaaS métier pour domaines, maisons et caves</p>
          <h1>La gestion de cave et de cuverie pensée pour les domaines, maisons et caves.</h1>
          <p className="hero-subtitle">
            Suivez vos lots, cuves, stocks, ordres de travail, analyses, dégustations et expéditions
            dans un espace sécurisé par organisation.
          </p>
          <div className="hero-actions">
            <a data-testid="public-demo-button" className="button primary" href={demoMailto}>
              Demander une démo
            </a>
            <Link data-testid="public-app-button" className="button secondary" href="/app">
              Accéder à l'application
            </Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="Aperçu fonctionnel">
          <div className="panel-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="panel-title">Pilotage cuverie</div>
          <div className="metric-grid">
            <div>
              <strong>Lots</strong>
              <span>Suivi par statut</span>
            </div>
            <div>
              <strong>Cuves</strong>
              <span>Volumes & affectations</span>
            </div>
            <div>
              <strong>Stocks</strong>
              <span>Intrants & matières sèches</span>
            </div>
            <div>
              <strong>Audit</strong>
              <span>Historique des actions</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section split">
        <div>
          <p className="eyebrow">Problème</p>
          <h2>Les caves suivent encore trop d'informations dispersées</h2>
        </div>
        <p>
          Tableurs, carnets, messages, fichiers partagés et mémoire d'équipe rendent le suivi quotidien
          fragile, surtout en période de vendanges, de tirage ou d'expéditions.
        </p>
      </section>

      <section className="section">
        <p className="eyebrow">Solution</p>
        <h2>Un espace unique pour piloter la cuverie</h2>
        <div className="tag-grid">
          {solutionItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section id="modules" data-testid="public-modules-section" className="section">
        <p className="eyebrow">Modules</p>
        <h2>Les fonctions essentielles au quotidien</h2>
        <div className="card-grid">
          {modules.map((module) => (
            <article key={module} className="card">
              <h3>{module}</h3>
              <p>Un suivi clair, structuré et exploitable par les équipes habilitées.</p>
            </article>
          ))}
        </div>
      </section>

      <section id="securite" data-testid="public-security-section" className="section security">
        <div>
          <p className="eyebrow">Sécurité / multi-entreprise</p>
          <h2>Des données séparées par organisation</h2>
        </div>
        <p>
          Chaque utilisateur est rattaché à une seule organisation. Les données métier sont affichées
          et manipulées uniquement dans l'espace de l'organisation connectée.
        </p>
      </section>

      <section className="section">
        <p className="eyebrow">Pour qui ?</p>
        <h2>Conçu pour les structures viticoles exigeantes</h2>
        <div className="audience-grid">
          {audiences.map((audience) => (
            <article key={audience} className="audience-card">
              {audience}
            </article>
          ))}
        </div>
      </section>

      <section id="demo" data-testid="public-demo-section" className="section demo">
        <p className="eyebrow">Démo</p>
        <h2>Découvrir Ma Cuverie</h2>
        <p>
          Ma Cuverie est actuellement en préparation pour des démonstrations et retours terrain.
        </p>
        <a className="button primary" href={demoMailto}>
          Demander une démo
        </a>
      </section>

      <footer data-testid="public-footer" className="footer">
        <div>
          <strong>Ma Cuverie</strong>
          <span>Gestion de cave et de cuverie</span>
        </div>
        <nav aria-label="Liens de pied de page">
          <Link data-testid="public-legal-link-mentions" href="/legal/mentions-legales">
            Mentions légales
          </Link>
          <Link data-testid="public-legal-link-privacy" href="/legal/confidentialite">
            Confidentialité
          </Link>
          <Link href="/legal/conditions-utilisation">Conditions d'utilisation</Link>
          <Link href="/legal/securite">Sécurité & données</Link>
          <Link href="/legal/cookies">Cookies</Link>
          <Link href="/app">Accéder à l'application</Link>
        </nav>
      </footer>

      <style>{`
        .public-home {
          min-height: 100vh;
          background: #f7f3ec;
          color: #2a2520;
          font-family: Arial, Helvetica, sans-serif;
        }

        .site-header,
        .hero,
        .section,
        .footer {
          width: min(1120px, calc(100% - 40px));
          margin: 0 auto;
        }

        .site-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 24px 0;
        }

        .brand {
          color: #5a3e0e;
          font-family: Georgia, serif;
          font-size: 24px;
          text-decoration: none;
          letter-spacing: .4px;
        }

        .top-nav {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          font-size: 13px;
        }

        .top-nav a,
        .footer a {
          color: #6f665c;
          text-decoration: none;
        }

        .top-nav a:hover,
        .footer a:hover {
          color: #8b6318;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(320px, .88fr);
          gap: 42px;
          align-items: center;
          padding: 72px 0 64px;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #8b6318;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        p {
          overflow-wrap: anywhere;
        }

        h1 {
          max-width: 760px;
          margin: 0;
          color: #1a1510;
          font-family: Georgia, serif;
          font-size: 56px;
          line-height: 1.04;
          font-weight: 600;
        }

        h2 {
          margin: 0;
          color: #1a1510;
          font-family: Georgia, serif;
          font-size: 34px;
          line-height: 1.18;
          font-weight: 600;
        }

        h3 {
          margin: 0;
          color: #2a2520;
          font-size: 16px;
        }

        .hero-subtitle,
        .section p {
          color: #5f574e;
          font-size: 16px;
          line-height: 1.7;
        }

        .hero-subtitle {
          max-width: 690px;
          margin: 22px 0 0;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 30px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .8px;
          text-decoration: none;
          text-transform: uppercase;
        }

        .button.primary {
          background: #8b6318;
          color: #fffaf0;
        }

        .button.secondary {
          background: #ffffff;
          color: #5a3e0e;
          border: 1px solid #d8cfc0;
        }

        .hero-panel {
          background: #ffffff;
          border: 1px solid #e4ddd1;
          border-top: 3px solid #8b6318;
          border-radius: 8px;
          padding: 22px;
          box-shadow: 0 18px 50px rgba(69, 48, 17, .12);
        }

        .panel-bar {
          display: flex;
          gap: 6px;
          margin-bottom: 22px;
        }

        .panel-bar span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #d8cfc0;
        }

        .panel-title {
          color: #1a1510;
          font-family: Georgia, serif;
          font-size: 24px;
          margin-bottom: 18px;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .metric-grid div,
        .card,
        .audience-card {
          background: #fbfaf7;
          border: 1px solid #e7dfd2;
          border-radius: 8px;
          padding: 16px;
        }

        .metric-grid strong,
        .metric-grid span {
          display: block;
        }

        .metric-grid strong {
          color: #5a3e0e;
          font-size: 14px;
          margin-bottom: 5px;
        }

        .metric-grid span {
          color: #7a7268;
          font-size: 12px;
          line-height: 1.45;
        }

        .section {
          padding: 62px 0;
          border-top: 1px solid #e7dfd2;
        }

        .split,
        .security {
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
          gap: 38px;
          align-items: start;
        }

        .split p,
        .security p,
        .demo p {
          margin: 0;
        }

        .tag-grid,
        .card-grid,
        .audience-grid {
          display: grid;
          gap: 14px;
          margin-top: 26px;
        }

        .tag-grid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }

        .tag-grid span {
          background: #ffffff;
          border: 1px solid #e4ddd1;
          border-radius: 999px;
          padding: 12px 14px;
          color: #5a3e0e;
          font-size: 13px;
          text-align: center;
        }

        .card-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .card p {
          margin: 9px 0 0;
          font-size: 13px;
          line-height: 1.6;
        }

        .audience-grid {
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        }

        .audience-card {
          color: #5a3e0e;
          font-weight: 700;
        }

        .demo {
          background: #ffffff;
          border: 1px solid #e4ddd1;
          border-radius: 8px;
          padding: 34px;
          margin-top: 40px;
          margin-bottom: 56px;
        }

        .demo .button {
          margin-top: 22px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 0 36px;
          border-top: 1px solid #e7dfd2;
          color: #6f665c;
        }

        .footer strong,
        .footer span {
          display: block;
        }

        .footer strong {
          color: #5a3e0e;
          font-family: Georgia, serif;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .footer span {
          font-size: 13px;
        }

        .footer nav {
          display: flex;
          justify-content: flex-end;
          gap: 12px 18px;
          flex-wrap: wrap;
          font-size: 12px;
        }

        @media (max-width: 820px) {
          .site-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .hero,
          .split,
          .security {
            grid-template-columns: 1fr;
          }

          .hero {
            padding: 44px 0 54px;
          }

          h1 {
            font-size: 40px;
          }

          h2 {
            font-size: 28px;
          }

          .metric-grid {
            grid-template-columns: 1fr;
          }

          .footer {
            flex-direction: column;
          }

          .footer nav {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
