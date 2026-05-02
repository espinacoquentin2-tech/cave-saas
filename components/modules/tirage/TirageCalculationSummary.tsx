"use client";
// @ts-nocheck

import { useTheme } from "@/lib/store";
import { normalizeTirageBouchage } from "@/lib/tirage";

export function TirageCalculationSummary({
  isSubmitting,
  planningIsReady,
  planningPrimaryIssue,
  planningBottleCount,
  planningPlanPreview,
  planningSourceLotCode,
  planningForm,
}: any) {
  const T = useTheme();

  return (
    <>
      <div style={{ fontSize:14, fontWeight:"bold", color:T.textStrong }}>Synthèse du tirage préparé</div>
      <div style={{
        background: planningIsReady ? T.green+"11" : T.surfaceHigh,
        border: `1px solid ${planningIsReady ? T.green+"33" : planningPrimaryIssue ? T.red+"33" : T.border}`,
        borderRadius: 6,
        padding: 14,
      }}>
        <div style={{ fontSize:12, fontWeight:"bold", color: planningIsReady ? T.green : planningPrimaryIssue ? T.red : T.textStrong, marginBottom:6 }}>
          {isSubmitting
            ? "Création du tirage en cours"
            : planningIsReady
              ? "Planification prête pour un tirage réel"
              : "Action en attente de validation"}
        </div>
        <div style={{ fontSize:12, color: planningPrimaryIssue ? T.red : T.textDim, lineHeight:1.5 }}>
          {isSubmitting
            ? "Le bouton reste verrouillé pendant l'enregistrement pour éviter tout double submit."
            : planningIsReady
              ? `${planningBottleCount.toLocaleString('fr-FR')} bouteilles seront créées et ${planningPlanPreview.consumedVolumeHl.toFixed(3)} hL seront consommés sur ${planningSourceLotCode}.`
              : planningPrimaryIssue || "Complétez la planification pour activer la création du tirage."}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Cols calculés</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{planningBottleCount.toLocaleString('fr-FR')}</div></div>
        <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Volume réel consommé</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{planningPlanPreview.consumedVolumeHl.toFixed(3)} hL</div></div>
        <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Reliquat théorique</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{planningPlanPreview.remainderVolumeHl.toFixed(3)} hL</div></div>
        <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Bouchage</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{normalizeTirageBouchage(planningForm.bouchage)}</div></div>
      </div>
    </>
  );
}
