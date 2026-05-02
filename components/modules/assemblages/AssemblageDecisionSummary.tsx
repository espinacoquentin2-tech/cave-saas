"use client";
// @ts-nocheck

import React from "react";
import { Badge, FF, Input } from "@/components/ui";
import { useTheme } from "@/lib/store";

export function AssemblageDecisionSummary({
  totalVolumeHl,
  proposedCode,
  assemblageLabels,
  assemblageType,
  decision,
  vintageEntries,
  compositionEntries,
  notes,
  setNotes,
  validationErrors,
  isSubmitting,
}: any) {
  const T = useTheme();

  return (
    <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
      <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>F. Résultat calculé</div>
      <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:18 }}>
        <div>
          <div style={{ fontSize:30, color:T.textStrong, fontFamily:"Georgia, serif" }}>{totalVolumeHl.toFixed(2)} hL</div>
          <div style={{ fontSize:11, color:T.textDim, marginTop:6 }}>Volume final total</div>
          <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700, marginTop:14, wordBreak:"break-all" }}>{proposedCode}</div>
        </div>
        <div style={{ display:"grid", gap:10 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Badge label={`Demandé: ${assemblageLabels[assemblageType]}`} color={T.textDim} />
            <Badge label={`Suggéré: ${assemblageLabels[decision.suggestedType]}`} color={T.accent} />
            {decision.isBlancDeBlancs && <Badge label="Blanc de blancs" color="#e6c27a" />}
            {decision.isBlancDeNoirs && <Badge label="Blanc de noirs" color="#8c7355" />}
            {decision.isRoseCandidate && <Badge label="Rosé d'assemblage" color={T.red} />}
            {decision.isMillesimeCandidate && vintageEntries.length === 1 && <Badge label={`Millésime ${vintageEntries[0][0]}`} color={T.blue} />}
          </div>
          <div style={{ fontSize:12, color:T.text }}>
            <strong>Pourcentage par cépage:</strong> {compositionEntries.length > 0 ? compositionEntries.map(([grape, pct]: any) => `${grape} ${Number(pct).toFixed(2)} %`).join(" / ") : "--"}
          </div>
          <div style={{ fontSize:12, color:T.text }}>
            <strong>Pourcentage par millésime:</strong> {vintageEntries.length > 0 ? vintageEntries.map(([year, pct]: any) => `${year} ${Number(pct).toFixed(2)} %`).join(" / ") : "--"}
          </div>
          <div style={{ fontSize:12, color:T.text }}>
            <strong>Vin de réserve:</strong> {decision.reserveShare.toFixed(2)} % | <strong>Vin rouge:</strong> {decision.redWineShare.toFixed(2)} %
          </div>
          <FF label="Notes opérateur">
            <Input value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} disabled={isSubmitting} placeholder="Commentaires, consignes cave, objectif du lot..." />
          </FF>
        </div>
      </div>

      {(decision.warnings.length > 0 || validationErrors.length > 0) && (
        <div style={{ marginTop:14, padding:14, borderRadius:6, border:`1px solid ${T.red}44`, background:`${T.red}11` }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.red, fontWeight:700, marginBottom:8 }}>Alertes métier</div>
          {[...decision.warnings, ...validationErrors].map((warning: any, index: number) => (
            <div key={`warning-${index}`} style={{ fontSize:12, color:T.text, lineHeight:1.5 }}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
