export const PHASES_DEGUSTATION = [
  { id: "BAIES", label: "🍇 Baies", desc: "Maturité phénolique sur parcelle" },
  { id: "FERMENTATION", label: "🧪 Fermentation", desc: "Moûts et FA/FML en cours" },
  { id: "VINS_CLAIRS", label: "🍷 Vins Clairs", desc: "Vins de base & Réserve" },
  { id: "DOSAGE", label: "🍾 Essais Dosage", desc: "Tests de liqueur pré-dégorgement" },
  { id: "CHAMPAGNE", label: "🥂 Produit Fini", desc: "Contrôle après vieillissement" } // 👈 Remplacé FINI par CHAMPAGNE
];

export const VISUEL_TAGS = ["Couleur", "Reflets", "Effervescence"];

export const OLFACTIF_TAXONOMY = [
  "Fruit frais", "Floral", "Végétal", "Épice", "Lactique", "Boulangerie", "Empyreumatique",
  "Évolution oxydative", "Réduction", "Animal", "Minéral / SO2", "Amylique", "Acescence / solvant",
  "Acétique", "Boisé", "Carton", "Champignon / moisi / terreux"
];

export const GUSTATIF_TAXONOMY = [
  "Acide", "Amer", "Sucré", "Salé", "Rond", "Astringent / asséchant", "Huileux",
  "Très effervescent", "Plus intense", "Maigre / dilué", "Lourd", "Déséquilibré"
];

export const BAIES_ECRASEMENT = ["Faible", "Moyenne", "Bonne", "Très bonne"];
export const BAIES_NATURE_CITRONNEE = ["Absente", "Légère", "Marquée"];
export const BAIES_VENDANGE = ["Plus d’une semaine", "Dans quelques jours", "Prêt à vendanger"];
export const BAIES_DATA_PREFIX = "BAIES_DATA::";

export const BAIES_LABELS: Record<string, string> = {
  aptitudeEcrasement: "Aptitude écrasement",
  sucrosite: "Sucrosité",
  acidite: "Acidité",
  vegetal: "Végétal",
  fruite: "Fruité",
  natureCitronnee: "Nature citronnée",
  aromePellicule: "Arôme pellicule",
  astringencePellicule: "Astringence pellicule",
  vendange: "Vendange",
};

export const BAIES_RADAR_AXES = ["sucrosite", "acidite", "vegetal", "fruite", "aromePellicule", "astringencePellicule"];
export const BAIES_TEXT_ORDER = ["aptitudeEcrasement", "natureCitronnee", ...BAIES_RADAR_AXES, "vendange"];
