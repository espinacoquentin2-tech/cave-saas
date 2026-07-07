export type OadVisualKind =
  | "maturity"
  | "fermentation"
  | "analysis"
  | "tasting"
  | "blend"
  | "tirage";

const colors = {
  ink: "#2a2520",
  muted: "#8a7d6a",
  axis: "#d8cbb7",
  paper: "#fffdf8",
  cream: "#f6f0e6",
  gold: "#c9a84c",
  brown: "#8b6318",
  wine: "#7f1d34",
  green: "#4d7a55",
  taupe: "#b8aa97",
};

function ChartFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg className="product-svg" viewBox="0 0 360 150" role="img" aria-label={label}>
      <rect x="1" y="1" width="358" height="148" rx="16" fill={colors.paper} stroke="#e8ddcc" />
      {children}
    </svg>
  );
}

export function MaturityTrendVisual() {
  return (
    <ChartFrame label="Suivi maturité parcellaire avec courbes sucre et acidité">
      <rect x="226" y="24" width="62" height="90" rx="10" fill="#f8efe2" stroke="#ead8bd" />
      <text x="236" y="43" fill={colors.brown} fontSize="10" fontWeight="700">Fenêtre</text>
      <line x1="42" y1="116" x2="322" y2="116" stroke={colors.axis} />
      <line x1="42" y1="30" x2="42" y2="116" stroke={colors.axis} />
      <line x1="42" y1="88" x2="322" y2="88" stroke="#eadfce" strokeDasharray="4 5" />
      <line x1="42" y1="60" x2="322" y2="60" stroke="#eadfce" strokeDasharray="4 5" />
      <path d="M48 101 C94 96 116 84 153 73 C193 61 222 49 284 39" fill="none" stroke={colors.wine} strokeWidth="4" strokeLinecap="round" />
      <path d="M48 42 C98 50 130 58 163 66 C204 76 239 88 306 100" fill="none" stroke={colors.gold} strokeWidth="4" strokeLinecap="round" />
      {[92, 168, 248].map((x, index) => (
        <g key={x}>
          <circle cx={x} cy={[92, 69, 46][index]} r="5" fill={colors.paper} stroke={colors.wine} strokeWidth="3" />
          <circle cx={x} cy={[50, 67, 90][index]} r="5" fill={colors.paper} stroke={colors.gold} strokeWidth="3" />
        </g>
      ))}
      <text x="48" y="132" fill={colors.muted} fontSize="10">Prélèvements</text>
      <text x="214" y="132" fill={colors.wine} fontSize="10">Maturité</text>
      <text x="278" y="132" fill={colors.gold} fontSize="10">Acidité</text>
    </ChartFrame>
  );
}

export function FermentationCurveVisual() {
  return (
    <ChartFrame label="Courbe de fermentation alcoolique avec ralentissement et température">
      <rect x="206" y="26" width="82" height="90" rx="12" fill="#fbf1f2" stroke="#edd3d9" />
      <text x="223" y="43" fill={colors.wine} fontSize="10" fontWeight="700">Zone Lente</text>
      <line x1="42" y1="116" x2="320" y2="116" stroke={colors.axis} />
      <line x1="42" y1="28" x2="42" y2="116" stroke={colors.axis} />
      <path d="M50 39 C88 45 113 53 145 66 C180 80 210 95 260 104 C282 108 302 111 320 112" fill="none" stroke={colors.wine} strokeWidth="4" strokeLinecap="round" />
      {[74, 126, 184, 238, 298].map((x, index) => (
        <circle key={x} cx={x} cy={[44, 58, 81, 101, 111][index]} r="5" fill={colors.paper} stroke={colors.wine} strokeWidth="3" />
      ))}
      <path d="M52 126 H148" stroke={colors.gold} strokeWidth="4" strokeLinecap="round" />
      <circle cx="164" cy="126" r="10" fill="#eef4ea" stroke="#ccddc5" />
      <text x="181" y="130" fill={colors.green} fontSize="11" fontWeight="700">18 °C</text>
      <text x="48" y="132" fill={colors.muted} fontSize="10">1088</text>
      <text x="286" y="132" fill={colors.muted} fontSize="10">1010</text>
    </ChartFrame>
  );
}

export function AnalysisRadarOrPanelVisual() {
  const rows = [
    ["pH", "3,12", 72],
    ["AT", "7,2", 58],
    ["SO₂ libre", "18", 44],
    ["Sucres", "1,8", 28],
    ["Azote", "Param.", 64],
  ] as const;

  return (
    <ChartFrame label="Panneau analytique œnologique par lot">
      <text x="28" y="31" fill={colors.brown} fontSize="12" fontWeight="700">Profil Analytique</text>
      {rows.map(([label, value, width], index) => {
        const y = 48 + index * 18;
        return (
          <g key={label}>
            <text x="30" y={y} fill={colors.ink} fontSize="10" fontWeight="700">{label}</text>
            <rect x="100" y={y - 8} width="142" height="7" rx="4" fill={colors.cream} />
            <rect x="100" y={y - 8} width={width} height="7" rx="4" fill={index === 2 ? colors.green : colors.gold} />
            <text x="260" y={y} fill={colors.muted} fontSize="10">{value}</text>
          </g>
        );
      })}
      <rect x="286" y="36" width="42" height="42" rx="10" fill="#eef4ea" stroke="#ccddc5" />
      <path d="M298 59 L309 68 L320 48" fill="none" stroke={colors.green} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="278" y="102" fill={colors.muted} fontSize="10">Historique</text>
    </ChartFrame>
  );
}

export function TastingProfileVisual() {
  const axes = [
    ["Tension", 78, colors.wine],
    ["Volume", 62, colors.gold],
    ["Fruit", 86, colors.green],
    ["Oxydation", 34, colors.taupe],
    ["Équilibre", 70, colors.brown],
  ] as const;

  return (
    <ChartFrame label="Profil sensoriel de dégustation avec curseurs">
      <text x="28" y="31" fill={colors.brown} fontSize="12" fontWeight="700">Profil Sensoriel</text>
      {axes.map(([label, value, color], index) => {
        const y = 48 + index * 18;
        return (
          <g key={label}>
            <text x="30" y={y} fill={colors.ink} fontSize="10" fontWeight="700">{label}</text>
            <line x1="118" y1={y - 4} x2="300" y2={y - 4} stroke={colors.cream} strokeWidth="7" strokeLinecap="round" />
            <line x1="118" y1={y - 4} x2={118 + value * 1.82} y2={y - 4} stroke={color} strokeWidth="7" strokeLinecap="round" />
            <circle cx={118 + value * 1.82} cy={y - 4} r="6" fill={colors.paper} stroke={color} strokeWidth="3" />
          </g>
        );
      })}
    </ChartFrame>
  );
}

export function BlendCompositionVisual() {
  return (
    <ChartFrame label="Composition d'assemblage par cépage et réserve">
      <text x="28" y="31" fill={colors.brown} fontSize="12" fontWeight="700">Composition Cuvée</text>
      <rect x="30" y="52" width="74" height="38" rx="8" fill={colors.gold} />
      <rect x="104" y="52" width="64" height="38" rx="0" fill={colors.wine} />
      <rect x="168" y="52" width="58" height="38" rx="0" fill={colors.green} />
      <rect x="226" y="52" width="52" height="38" rx="8" fill={colors.brown} />
      <text x="32" y="112" fill={colors.muted} fontSize="10">CH</text>
      <text x="102" y="112" fill={colors.muted} fontSize="10">PM</text>
      <text x="164" y="112" fill={colors.muted} fontSize="10">PN</text>
      <text x="222" y="112" fill={colors.muted} fontSize="10">Réserve</text>
      <rect x="292" y="38" width="38" height="72" rx="10" fill="#f8f2e9" stroke="#e3d7c6" />
      <text x="300" y="68" fill={colors.brown} fontSize="12" fontWeight="700">45</text>
      <text x="300" y="84" fill={colors.muted} fontSize="10">hL</text>
    </ChartFrame>
  );
}

export function TiragePlanningVisual() {
  const rows = [
    ["Base Prête", 50, 70, colors.green],
    ["Intrants", 88, 110, colors.gold],
    ["Tirage", 132, 176, colors.wine],
    ["Sur Lattes", 196, 248, colors.brown],
  ] as const;

  return (
    <ChartFrame label="Planning de tirage avec base, intrants, tirage et mise sur lattes">
      <text x="28" y="31" fill={colors.brown} fontSize="12" fontWeight="700">Planification Tirage · Semaine 12</text>
      <text x="270" y="31" fill={colors.muted} fontSize="10">45 hL Base</text>
      {[64, 108, 152, 196, 240, 284].map((x) => (
        <line key={x} x1={x} y1="46" x2={x} y2="124" stroke="#eadfce" strokeDasharray="3 5" />
      ))}
      {rows.map(([label, start, end, color], index) => {
        const y = 58 + index * 20;
        return (
          <g key={label}>
            <text x="30" y={y + 4} fill={colors.ink} fontSize="10" fontWeight="700">{label}</text>
            <rect x="112" y={y - 7} width="190" height="12" rx="6" fill={colors.cream} />
            <rect x={start + 72} y={y - 7} width={end - start} height="12" rx="6" fill={color} />
            <circle cx={end + 72} cy={y - 1} r="5" fill={colors.paper} stroke={color} strokeWidth="3" />
          </g>
        );
      })}
      <text x="114" y="136" fill={colors.muted} fontSize="9">Préparation</text>
      <text x="204" y="136" fill={colors.muted} fontSize="9">Tirage</text>
      <text x="268" y="136" fill={colors.muted} fontSize="9">Mise Sur Lattes</text>
    </ChartFrame>
  );
}

export function OadVisual({ visual }: { visual: OadVisualKind }) {
  switch (visual) {
    case "maturity":
      return <MaturityTrendVisual />;
    case "fermentation":
      return <FermentationCurveVisual />;
    case "analysis":
      return <AnalysisRadarOrPanelVisual />;
    case "tasting":
      return <TastingProfileVisual />;
    case "blend":
      return <BlendCompositionVisual />;
    case "tirage":
      return <TiragePlanningVisual />;
  }
}

export function MiniFermentationChart() {
  return (
    <svg className="mini-fermentation-svg" viewBox="0 0 260 104" role="img" aria-label="Mini courbe de fermentation alcoolique">
      <line x1="16" y1="84" x2="244" y2="84" stroke={colors.axis} />
      <line x1="16" y1="16" x2="16" y2="84" stroke={colors.axis} />
      <rect x="164" y="24" width="54" height="58" rx="8" fill="#fbf1f2" />
      <path d="M22 22 C58 29 86 43 118 58 C151 73 185 79 238 84" fill="none" stroke={colors.wine} strokeWidth="4" strokeLinecap="round" />
      {[42, 92, 146, 198, 230].map((x, index) => (
        <circle key={x} cx={x} cy={[27, 45, 68, 80, 84][index]} r="4" fill={colors.paper} stroke={colors.wine} strokeWidth="3" />
      ))}
      <text x="20" y="99" fill={colors.muted} fontSize="9">densité</text>
      <text x="178" y="43" fill={colors.wine} fontSize="9" fontWeight="700">à suivre</text>
    </svg>
  );
}

export function DashboardPreviewVisual() {
  return (
    <svg className="dashboard-preview-svg" viewBox="0 0 720 360" role="img" aria-label="Mockup de tableau de bord Ma Cuverie avec KPI et taux de remplissage">
      <rect x="1" y="1" width="718" height="358" rx="18" fill="#17130f" />
      <rect x="20" y="20" width="680" height="54" rx="12" fill="#211b15" stroke="rgba(226, 196, 122, .18)" />
      <text x="40" y="51" fill="#f0e8d8" fontSize="20" fontWeight="700">Tableau De Bord</text>
      <text x="550" y="51" fill="#c9a84c" fontSize="12" fontWeight="700">Espace Champagne</text>

      {[
        ["Volume En Cave", "Vins Clairs", "Remplissage Global", colors.gold],
        ["Lots Actifs", "Suivi Par Statut", "FA & Assemblages", colors.wine],
        ["Contenants Actifs", "Cuves & Fûts", "Capacité Disponible", colors.green],
        ["Sur Lattes", "Lots Bouteilles", "Tirage À Suivre", colors.brown],
      ].map(([title, value, sub, color], index) => {
        const x = 20 + index * 172;
        return (
          <g key={title}>
            <rect x={x} y="94" width="156" height="82" rx="12" fill="#211b15" stroke="rgba(226, 196, 122, .18)" />
            <rect x={x} y="94" width="156" height="3" rx="2" fill={color} />
            <text x={x + 14} y="122" fill="#8a7d6a" fontSize="10" fontWeight="700">{title}</text>
            <text x={x + 14} y="148" fill="#f0e8d8" fontSize="16" fontWeight="700">{value}</text>
            <text x={x + 14} y="166" fill="#c9a84c" fontSize="10">{sub}</text>
          </g>
        );
      })}

      <rect x="20" y="198" width="330" height="124" rx="12" fill="#211b15" stroke="rgba(226, 196, 122, .18)" />
      <text x="42" y="228" fill="#f0e8d8" fontSize="16" fontWeight="700">Taux De Remplissage</text>
      <text x="262" y="228" fill="#c9a84c" fontSize="12" fontWeight="700">Vue Globale</text>
      <rect x="42" y="252" width="260" height="14" rx="7" fill="#302820" />
      <rect x="42" y="252" width="182" height="14" rx="7" fill={colors.gold} />
      <rect x="42" y="282" width="96" height="10" rx="5" fill={colors.wine} />
      <rect x="150" y="282" width="72" height="10" rx="5" fill={colors.green} />
      <rect x="234" y="282" width="68" height="10" rx="5" fill={colors.brown} />
      <text x="42" y="306" fill="#8a7d6a" fontSize="10">Cuverie · Fûts · Bases Tirage</text>

      <rect x="374" y="198" width="326" height="124" rx="12" fill="#211b15" stroke="rgba(226, 196, 122, .18)" />
      <text x="396" y="228" fill="#f0e8d8" fontSize="16" fontWeight="700">Priorités Du Jour</text>
      {[
        ["Tour FA", "Lots À Surveiller", colors.wine],
        ["Tirage", "Intrants À Préparer", colors.gold],
        ["Audit", "Opérations Récentes", colors.green],
      ].map(([label, text, color], index) => {
        const y = 250 + index * 22;
        return (
          <g key={label}>
            <circle cx="404" cy={y - 4} r="5" fill={color} />
            <text x="418" y={y} fill="#c9a84c" fontSize="10" fontWeight="700">{label}</text>
            <text x="486" y={y} fill="#d8cbb7" fontSize="10">{text}</text>
          </g>
        );
      })}
    </svg>
  );
}
