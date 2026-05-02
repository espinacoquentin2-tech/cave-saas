"use client";
// @ts-nocheck

import React from "react";
import { Badge, FF, Select } from "@/components/ui";
import { useTheme } from "@/lib/store";

export function AssemblageDestinationSelector({
  destinationContainerId,
  setDestinationContainerId,
  destinationCandidates,
  isSubmitting,
}: any) {
  const T = useTheme();

  return (
    <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
      <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>D. Cuve destination</div>
      <FF label="Choisir une cuve d'assemblage">
        <Select value={destinationContainerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDestinationContainerId(e.target.value)} disabled={isSubmitting}>
          <option value="">-- Choisir une cuve de réception --</option>
          {destinationCandidates.map((container: any) => (
            <option key={container.id} value={container.id} disabled={!!container.disabledReason}>
              {(container.displayName || container.name)} - cap. {container.capacity} hL - libre {container.availableVolume.toFixed(2)} hL{container.disabledReason ? ` - ${container.disabledReason}` : ""}
            </option>
          ))}
        </Select>
      </FF>
      <div style={{ display:"grid", gap:10, marginTop:12 }}>
        {destinationCandidates.map((container: any) => (
          <div key={`dest-${container.id}`} style={{ padding:"10px 12px", border:`1px solid ${String(container.id) === String(destinationContainerId) ? T.accent : T.border}`, borderRadius:4, background:String(container.id) === String(destinationContainerId) ? `${T.accent}11` : "transparent", opacity: container.disabledReason ? 0.65 : 1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ fontSize:12, color:T.textStrong }}>{container.displayName || container.name}</div>
                <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>
                  Capacité {container.capacity} hL | Volume actuel {container.currentVolume.toFixed(2)} hL | Disponible {container.availableVolume.toFixed(2)} hL
                </div>
              </div>
              <Badge label={container.status} color={container.disabledReason ? T.textDim : T.accent} />
            </div>
            {container.disabledReason && <div style={{ fontSize:11, color:T.red, marginTop:8 }}>{container.disabledReason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
