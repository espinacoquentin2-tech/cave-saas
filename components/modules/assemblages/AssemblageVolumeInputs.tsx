"use client";
// @ts-nocheck

import React from "react";
import { Badge, FF, Input } from "@/components/ui";
import { useTheme } from "@/lib/store";

export function AssemblageVolumeInputs({
  selectedSources,
  selectedSourceRows,
  buildSourceKey,
  readSourceDraft,
  updateSourceDraft,
  isSubmitting,
}: any) {
  const T = useTheme();

  return (
    <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
      <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>C. Sélection des volumes</div>
      {selectedSources.length === 0 ? (
        <div style={{ fontSize:12, color:T.textDim }}>Sélectionnez au moins une source dans la liste ci-dessus.</div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {selectedSourceRows.map((row: any) => (
            <div key={buildSourceKey(row.source)} style={{ border:`1px solid ${row.isOverAvailable ? T.red : T.border}`, borderRadius:6, padding:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700 }}>{row.source.code}</div>
                  <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>
                    Disponible: {row.isBottle ? `${row.source.availableCount} unités / ${row.availableVolumeHl.toFixed(3)} hL` : `${row.availableVolumeHl.toFixed(2)} hL`}
                  </div>
                </div>
                {row.isBottle && <Badge label={row.source.formatLabel} color={T.accentLight} />}
              </div>

              {row.isBottle ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 140px", gap:12 }}>
                  <FF label="Quantité source">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={readSourceDraft(row.source).countUsed || ""}
                      disabled={isSubmitting}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSourceDraft(row.source, { countUsed: e.target.value })}
                      placeholder="Nombre de bouteilles / magnums"
                    />
                  </FF>
                  <FF label="Volume prélevé (hL)">
                    <Input value={row.volumeHl ? row.volumeHl.toFixed(4) : ""} disabled />
                  </FF>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 140px", gap:12 }}>
                  <FF label="Volume prélevé (hL)">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={readSourceDraft(row.source).volumeHl || ""}
                      disabled={isSubmitting}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSourceDraft(row.source, { volumeHl: e.target.value })}
                      placeholder="Volume à prélever"
                    />
                  </FF>
                  <FF label="Disponible">
                    <Input value={row.availableVolumeHl.toFixed(2)} disabled />
                  </FF>
                </div>
              )}

              {row.isBottle && row.countUsed > 0 && (
                <div style={{ fontSize:11, color:T.textDim, marginTop:8 }}>
                  Conversion: {row.countUsed} x {row.source.formatLabel} = {row.volumeHl.toFixed(4)} hL.
                </div>
              )}
              {row.isOverAvailable && (
                <div style={{ fontSize:11, color:T.red, marginTop:8 }}>
                  Le volume demandé dépasse le stock disponible.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
