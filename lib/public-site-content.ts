export const PUBLIC_DEMO_MAILTO =
  "mailto:contact@macuverie.fr?subject=Demande%20de%20démo%20Ma%20Cuverie";

export const publicHero = {
  badge: "Gestion de cave champenoise & aide à la décision",
  title: "Pilotez votre cuverie du raisin au tirage",
  subtitle:
    "Ma Cuverie centralise vos vins clairs, lots, contenants, analyses, dégustations, assemblages, ordres de travail et plans de tirage dans un espace sécurisé par organisation.",
  reassurance:
    "Pensé pour les caves et maisons de Champagne, les vignerons, coopératives et structures d'élevage.",
};

export const workflowSteps = [
  {
    title: "Maturité",
    text: "Suivez les parcelles, les tendances analytiques et les décisions de ramassage.",
  },
  {
    title: "Planification Vendanges",
    text: "Préparez les entrées, les volumes attendus et les affectations en cuverie.",
  },
  {
    title: "Réception & Pressurage",
    text: "Reliez les jus, lots, contenants et premières opérations.",
  },
  {
    title: "Vinification",
    text: "Suivez FA, FML, intrants, corrections et manipulations.",
  },
  {
    title: "Dégustation & Analyses",
    text: "Croisez les résultats analytiques avec les observations terrain.",
  },
  {
    title: "Assemblages",
    text: "Préparez vos cuvées, réserves, lots principaux et essais d'assemblage.",
  },
  {
    title: "Tirage",
    text: "Préparez les bases, intrants, lots bouteilles, ordres de travail et mise sur lattes.",
  },
  {
    title: "Expéditions",
    text: "Gardez la trace des sorties vrac, bouteilles et livraisons.",
  },
] as const;

export const oadCards = [
  {
    title: "Maturité & Vendanges",
    items: ["Suivi parcellaire", "Tendances analytiques", "Décision de ramassage"],
    badge: "Décision Vendanges",
    visual: "maturity",
  },
  {
    title: "Tour de FA",
    items: ["Densité / température", "Ralentissements à suivre", "Lots prioritaires"],
    badge: "Surveillance FA",
    visual: "fermentation",
  },
  {
    title: "Analyses",
    items: ["Suivi pH, AT, SO₂ et sucres", "Historique par lot", "Comparaison entre vins clairs"],
    badge: "Suivi Analytique",
    visual: "analysis",
  },
  {
    title: "Dégustation",
    items: ["Notes structurées", "Profils de vins clairs", "Arbitrages d'élevage"],
    badge: "Profil Sensoriel",
    visual: "tasting",
  },
  {
    title: "Assemblages",
    items: ["Composants", "Réserves", "Volumes disponibles", "Traçabilité des mouvements"],
    badge: "Composition",
    visual: "blend",
  },
  {
    title: "Planification Tirage",
    items: ["Bases disponibles", "Intrants nécessaires", "Ordres de travail", "Lots bouteilles et mise sur lattes"],
    badge: "Planning Cave",
    visual: "tirage",
  },
] as const;

export const securityItems = [
  "Un utilisateur = une organisation",
  "Rôles : admin, chef de cave, caviste, lecture seule",
  "Journal d'audit",
  "Données séparées par espace",
  "Historique des opérations",
] as const;

export const positioningPillars = [
  {
    title: "Vision Cave",
    text: "Vins clairs, lots, contenants, volumes et opérations au même endroit.",
  },
  {
    title: "Décision Œnologique",
    text: "Maturité, FA, analyses, dégustations, assemblages et tirage connectés.",
  },
  {
    title: "Exécution Terrain",
    text: "Ordres de travail, rôles, preuves d'exécution et historique.",
  },
] as const;

export const footerLinks = [
  { label: "Mentions légales", href: "/legal/mentions-legales", testId: "public-legal-link-mentions" },
  { label: "Confidentialité", href: "/legal/confidentialite", testId: "public-legal-link-privacy" },
  { label: "Conditions d'utilisation", href: "/legal/conditions-utilisation", testId: undefined },
  { label: "Sécurité & données", href: "/legal/securite", testId: undefined },
  { label: "Cookies", href: "/legal/cookies", testId: undefined },
  { label: "Accéder à l'application", href: "/app", testId: undefined },
] as const;
