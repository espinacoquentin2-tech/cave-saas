import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPreviewVisual, MiniFermentationChart, OadVisual } from "@/components/public-site/ProductVisuals";
import {
  PUBLIC_DEMO_MAILTO,
  footerLinks,
  oadCards,
  positioningPillars,
  publicHero,
  securityItems,
  workflowSteps,
} from "@/lib/public-site-content";

export const metadata: Metadata = {
  title: "Ma Cuverie - Gestion de cave et de cuverie",
  description:
    "Logiciel de gestion de cave, cuverie, lots, stocks, analyses, dégustations et traçabilité pour domaines, maisons et caves.",
};

export default function PublicHomePage() {
  return (
    <main data-testid="public-home-page" className="public-home">
      <header className="site-header">
        <Link data-testid="public-brand-title" href="/" className="brand">
          Ma Cuverie
        </Link>
        <nav className="top-nav" aria-label="Navigation principale">
          <a href="#oad">OAD</a>
          <a href="#workflow">Fonctionnalités</a>
          <a href="#tracabilite">Traçabilité</a>
          <a href="#demo">Démo</a>
          <Link className="nav-app-link" href="/app">
            Accéder à l'application
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{publicHero.badge}</p>
          <h1>{publicHero.title}</h1>
          <p className="positioning">
            Ma Cuverie, le cockpit de cave champenoise pour piloter vos vins clairs, vos cuves,
            vos assemblages et vos décisions de tirage.
          </p>
          <p className="hero-subtitle">{publicHero.subtitle}</p>
          <div className="hero-actions">
            <a data-testid="public-demo-button" className="button primary" href={PUBLIC_DEMO_MAILTO}>
              Demander une démo
            </a>
            <Link data-testid="public-app-button" className="button secondary" href="/app">
              Accéder à l'application
            </Link>
          </div>
          <p className="reassurance">{publicHero.reassurance}</p>
        </div>

        <div data-testid="public-hero-product-preview" className="product-preview" aria-label="Aperçu produit Ma Cuverie">
          <div className="preview-topbar">
            <div>
              <span className="preview-kicker">Tableau De Bord</span>
              <strong>Vue Cave Champagne</strong>
            </div>
            <span className="org-status">Données séparées par organisation</span>
          </div>
          <div className="preview-tabs">
            <span>Maturité</span>
            <span>Tour de FA</span>
            <span>Assemblage</span>
            <span>Tirage</span>
          </div>
          <div className="preview-kpis">
            <article>
              <span>Vins Clairs</span>
              <strong>Lots Actifs</strong>
            </article>
            <article>
              <span>Cuves Actives</span>
              <strong>Occupation</strong>
            </article>
            <article>
              <span>FA À Surveiller</span>
              <strong>Priorités</strong>
            </article>
            <article>
              <span>Tirage</span>
              <strong>Planning</strong>
            </article>
          </div>
          <div className="preview-body">
            <div className="fa-card">
              <div className="card-head">
                <span>Courbe FA</span>
                <strong>Lot En Suivi</strong>
              </div>
              <MiniFermentationChart />
            </div>
            <div className="operation-timeline">
              <span>Analyse Reçue</span>
              <span>Préparation Tirage</span>
              <span>Dégustation À Consolider</span>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" data-testid="public-workflow-section" className="section workflow-section">
        <div className="section-heading">
          <p className="eyebrow">Parcours Métier</p>
          <h2>Du suivi de maturité au tirage</h2>
          <p>
            Chaque étape du chai champenois reste reliée aux vins clairs, aux contenants, aux
            analyses, aux assemblages et aux décisions de tirage.
          </p>
        </div>
        <div className="workflow">
          {workflowSteps.map((step, index) => (
            <article key={step.title} className="workflow-step">
              <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="oad" data-testid="public-oad-section" className="section oad-section">
        <div className="section-heading centered">
          <p className="eyebrow">OAD Intégrés</p>
          <h2>Des OAD pour décider, assembler et préparer le tirage</h2>
          <p>
            Ma Cuverie aide à suivre les points sensibles, comparer les vins clairs et transformer les
            données de cave en actions opérationnelles.
          </p>
        </div>
        <div className="oad-grid">
          {oadCards.map((card) => (
            <article key={card.title} className="oad-card">
              <OadVisual visual={card.visual} />
              <div className="oad-card-heading">
                <h3>{card.title}</h3>
                <span>{card.badge}</span>
              </div>
              <ul>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section data-testid="public-cockpit-section" className="section dashboard-section">
        <div className="dashboard-copy">
          <p className="eyebrow">Tableau De Bord</p>
          <h2>Une vue claire des volumes, lots, contenants et priorités</h2>
          <p>
            Retrouvez un aperçu structuré des volumes en cave, lots actifs, contenants, alertes FA,
            tâches du jour et préparations de tirage.
          </p>
        </div>
        <div className="dashboard-mockup" aria-label="Mockup tableau de bord Ma Cuverie">
          <DashboardPreviewVisual />
        </div>
      </section>

      <section id="tracabilite" data-testid="public-security-section" className="section security-section">
        <div className="section-heading">
          <p className="eyebrow">Traçabilité / Sécurité</p>
          <h2>Traçabilité, rôles et séparation des données</h2>
          <p>
            Les données métier sont affichées et manipulées dans l'espace de l'organisation connectée.
            Les accès sont encadrés par des rôles et par un journal d'audit.
          </p>
        </div>
        <div className="security-list">
          {securityItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section data-testid="public-positioning-section" className="section positioning-section">
        <div className="section-heading centered">
          <p className="eyebrow">Différenciation</p>
          <h2>Pensé avec une logique œnologique champenoise, pas seulement administrative</h2>
          <p>
            Ma Cuverie est construit autour des gestes de cave : suivre une fermentation, préparer un
            assemblage, planifier un tirage, tracer un intrant, comparer des analyses et organiser les
            ordres de travail.
          </p>
        </div>
        <div className="pillar-grid">
          {positioningPillars.map((pillar) => (
            <article key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="demo" data-testid="public-demo-section" className="section final-cta">
        <p className="eyebrow">Démo Terrain</p>
        <h2>Prêt à tester Ma Cuverie sur votre propre cave ?</h2>
        <p>
          La solution est en préparation pour des démonstrations terrain avec des vignerons, maisons
          et caves de Champagne.
        </p>
        <div className="hero-actions">
          <a className="button primary" href={PUBLIC_DEMO_MAILTO}>
            Demander une démo
          </a>
          <Link className="button secondary" href="/app">
            Accéder à l'application
          </Link>
        </div>
        <span className="cta-note">Réponse personnalisée · Démo sur cas métier · Sans engagement</span>
      </section>

      <footer data-testid="public-footer" className="footer">
        <div>
          <strong>Ma Cuverie</strong>
          <span>Gestion de cave et de cuverie</span>
        </div>
        <nav aria-label="Liens de pied de page">
          {footerLinks.map((link) => (
            <Link key={link.href} data-testid={link.testId} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>

      <style>{`
        .public-home {
          min-height: 100vh;
          background:
            radial-gradient(circle at 82% 6%, rgba(139, 28, 49, .12), transparent 30%),
            linear-gradient(180deg, #fbf7ef 0%, #f3ece0 48%, #f8f4ed 100%);
          color: #2a2520;
          font-family: Arial, Helvetica, sans-serif;
          overflow-x: hidden;
        }

        .site-header,
        .hero,
        .section,
        .footer {
          width: min(1160px, calc(100% - 40px));
          margin: 0 auto;
        }

        .site-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 0;
        }

        .brand {
          color: #4f3510;
          font-family: Georgia, serif;
          font-size: 25px;
          letter-spacing: .3px;
          text-decoration: none;
        }

        .top-nav {
          display: flex;
          align-items: center;
          gap: 17px;
          flex-wrap: wrap;
          font-size: 13px;
        }

        .top-nav a,
        .footer a {
          color: #62584d;
          text-decoration: none;
        }

        .top-nav a:hover,
        .footer a:hover {
          color: #8b6318;
        }

        .nav-app-link {
          border: 1px solid #d8cbb7;
          border-radius: 999px;
          padding: 9px 13px;
          background: rgba(255, 255, 255, .72);
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, .95fr) minmax(420px, 1.05fr);
          gap: 46px;
          align-items: center;
          padding: 74px 0 78px;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #8b6318;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        p,
        li,
        span {
          overflow-wrap: anywhere;
        }

        h1 {
          max-width: 720px;
          margin: 0;
          color: #1a1510;
          font-family: Georgia, serif;
          font-size: 58px;
          line-height: 1.02;
          font-weight: 600;
        }

        h2 {
          margin: 0;
          color: #1a1510;
          font-family: Georgia, serif;
          font-size: 38px;
          line-height: 1.14;
          font-weight: 600;
        }

        h3 {
          margin: 0;
          color: #2a2520;
          font-size: 16px;
        }

        .positioning,
        .hero-subtitle,
        .section-heading p,
        .dashboard-copy p,
        .final-cta p,
        .pillar-grid p {
          color: #5f574e;
          font-size: 16px;
          line-height: 1.7;
        }

        .positioning {
          max-width: 660px;
          margin: 20px 0 0;
          color: #5a3e0e;
          font-weight: 700;
        }

        .hero-subtitle {
          max-width: 700px;
          margin: 16px 0 0;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 45px;
          padding: 0 19px;
          border-radius: 5px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .8px;
          text-decoration: none;
          text-transform: uppercase;
        }

        .button.primary {
          background: #7f1d34;
          color: #fffaf0;
          box-shadow: 0 12px 24px rgba(127, 29, 52, .18);
        }

        .button.secondary {
          background: #ffffff;
          color: #5a3e0e;
          border: 1px solid #d8cbb7;
        }

        .reassurance {
          margin: 16px 0 0;
          color: #746b60;
          font-size: 13px;
        }

        .product-preview,
        .dashboard-mockup,
        .final-cta {
          background: rgba(255, 255, 255, .9);
          border: 1px solid #e2d6c3;
          border-radius: 8px;
          box-shadow: 0 24px 70px rgba(74, 48, 17, .14);
        }

        .product-preview {
          position: relative;
          padding: 22px;
          overflow: hidden;
        }

        .product-preview::before {
          content: "";
          position: absolute;
          inset: 0;
          border-top: 4px solid #8b6318;
          pointer-events: none;
        }

        .preview-topbar {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .preview-kicker,
        .preview-topbar strong {
          display: block;
        }

        .preview-kicker {
          color: #8a7d6a;
          font-size: 10px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .preview-topbar strong {
          color: #1a1510;
          font-family: Georgia, serif;
          font-size: 24px;
        }

        .org-status {
          background: #eef4ea;
          border: 1px solid #ccddc5;
          color: #3f6b45;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          white-space: nowrap;
        }

        .preview-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }

        .preview-tabs span {
          background: #f6f0e6;
          border: 1px solid #e3d7c6;
          border-radius: 999px;
          color: #5a3e0e;
          font-size: 12px;
          padding: 9px 10px;
          text-align: center;
        }

        .preview-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .preview-kpis article,
        .fa-card,
        .operation-timeline,
        .oad-card,
        .workflow-step,
        .pillar-grid article {
          background: #fffdf8;
          border: 1px solid #e8ddcc;
          border-radius: 8px;
        }

        .preview-kpis article {
          padding: 12px;
        }

        .preview-kpis span,
        .preview-kpis strong {
          display: block;
        }

        .preview-kpis span {
          color: #8a7d6a;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .preview-kpis strong {
          color: #2a2520;
          font-size: 13px;
        }

        .preview-body {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(190px, .9fr);
          gap: 12px;
        }

        .fa-card {
          padding: 14px;
        }

        .card-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #7a7268;
          font-size: 12px;
          margin-bottom: 18px;
        }

        .card-head strong {
          color: #7f1d34;
        }

        .mini-fermentation-svg {
          display: block;
          width: 100%;
          height: 94px;
        }

        .operation-timeline {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .operation-timeline span {
          position: relative;
          padding-left: 18px;
          color: #5f574e;
          font-size: 12px;
          line-height: 1.4;
        }

        .operation-timeline span::before {
          content: "";
          position: absolute;
          left: 0;
          top: 6px;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #8b6318;
        }

        .section {
          padding: 72px 0;
          border-top: 1px solid rgba(139, 99, 24, .16);
        }

        .section-heading {
          max-width: 760px;
        }

        .section-heading.centered {
          margin: 0 auto;
          text-align: center;
        }

        .section-heading p,
        .final-cta p {
          margin: 16px 0 0;
        }

        .workflow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 30px;
        }

        .workflow-step {
          position: relative;
          min-height: 190px;
          padding: 18px;
          overflow: hidden;
        }

        .workflow-step::after {
          content: "";
          position: absolute;
          right: 16px;
          top: 16px;
          width: 42px;
          height: 42px;
          border: 1px solid #e3d7c6;
          border-radius: 50%;
          background: #f8f2e9;
        }

        .step-index {
          display: inline-flex;
          color: #8b6318;
          font-family: Georgia, serif;
          font-size: 24px;
          margin-bottom: 26px;
        }

        .workflow-step p,
        .oad-card li,
        .pillar-grid p {
          color: #655d53;
          font-size: 13px;
          line-height: 1.6;
        }

        .workflow-step p {
          margin: 10px 0 0;
        }

        .oad-section {
          background: rgba(255, 255, 255, .38);
          width: 100%;
          padding-left: max(20px, calc((100% - 1160px) / 2));
          padding-right: max(20px, calc((100% - 1160px) / 2));
        }

        .oad-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 32px;
        }

        .oad-card {
          min-height: 382px;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }

        .oad-card ul {
          margin: 14px 0 0;
          padding-left: 18px;
        }

        .oad-card li + li {
          margin-top: 5px;
        }

        .product-svg {
          display: block;
          width: 100%;
          height: auto;
          margin-bottom: 16px;
          filter: drop-shadow(0 10px 18px rgba(74, 48, 17, .06));
        }

        .oad-card-heading {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 9px;
        }

        .oad-card-heading span {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          border: 1px solid #e3d7c6;
          border-radius: 999px;
          background: #f8f2e9;
          color: #7f1d34;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .7px;
          line-height: 1.2;
          padding: 6px 8px;
          text-transform: uppercase;
        }

        .dashboard-section {
          display: grid;
          grid-template-columns: minmax(0, .72fr) minmax(0, 1.28fr);
          gap: 30px;
          align-items: center;
        }

        .dashboard-copy p {
          margin: 16px 0 0;
        }

        .dashboard-mockup {
          padding: 14px;
        }

        .dashboard-preview-svg {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 12px;
        }

        .security-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, .9fr);
          gap: 34px;
          align-items: start;
        }

        .security-list {
          display: grid;
          gap: 10px;
        }

        .security-list span {
          background: #fffdf8;
          border: 1px solid #e8ddcc;
          border-left: 3px solid #8b6318;
          border-radius: 7px;
          color: #51483f;
          padding: 13px 14px;
          font-size: 13px;
        }

        .pillar-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 30px;
        }

        .pillar-grid article {
          padding: 22px;
          border-top: 3px solid #8b6318;
        }

        .pillar-grid p {
          margin: 11px 0 0;
        }

        .final-cta {
          padding: 38px;
          margin-top: 38px;
          margin-bottom: 54px;
          text-align: center;
        }

        .final-cta .hero-actions {
          justify-content: center;
        }

        .cta-note {
          display: block;
          margin-top: 16px;
          color: #746b60;
          font-size: 13px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 30px 0 38px;
          border-top: 1px solid rgba(139, 99, 24, .18);
          color: #6f665c;
        }

        .footer strong,
        .footer span {
          display: block;
        }

        .footer strong {
          color: #4f3510;
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

        @media (max-width: 980px) {
          .hero,
          .dashboard-section,
          .security-section {
            grid-template-columns: 1fr;
          }

          .workflow,
          .oad-grid,
          .pillar-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .site-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-nav {
            gap: 10px 14px;
          }

          .hero {
            padding: 42px 0 58px;
          }

          h1 {
            font-size: 40px;
          }

          h2 {
            font-size: 29px;
          }

          .preview-tabs,
          .preview-kpis,
          .preview-body,
          .workflow,
          .oad-grid,
          .pillar-grid {
            grid-template-columns: 1fr;
          }

          .product-preview {
            padding: 16px;
          }

          .preview-topbar,
          .footer {
            flex-direction: column;
          }

          .org-status {
            white-space: normal;
          }

          .oad-card {
            min-height: auto;
          }

          .oad-card-heading span {
            max-width: 100%;
          }

          .footer nav {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
