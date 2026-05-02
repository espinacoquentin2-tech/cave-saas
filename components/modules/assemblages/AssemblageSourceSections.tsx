"use client";
// @ts-nocheck

import { Badge } from "@/components/ui";
import { LOT_STATUS_COLORS, useTheme } from "@/lib/store";
import { BOTTLE_FORMAT_TO_HL } from "@/lib/assemblage";

export function AssemblageSourceSections({ sourceCandidates, sourceSections, buildSourceKey }: any) {
  const T = useTheme();

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
      <div style={{ padding:"14px 16px", borderBottom:`1px solid ${T.border}`, fontSize:11, textTransform:"uppercase", color:T.textDim, letterSpacing:1 }}>Lots disponibles par famille</div>
      {sourceCandidates.length === 0 ? (
        <div style={{ padding:"36px 20px", textAlign:"center", color:T.textDim }}>Aucune source n'est actuellement exploitable pour un assemblage.</div>
      ) : (
        <div style={{ display:"grid", gap:16, padding:16 }}>
          {sourceSections.map((section: any) => (
            <div key={section.key} style={{ border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden" }}>
              <div style={{ padding:"12px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                <div>
                  <div style={{ fontSize:12, color:T.textStrong, fontWeight:700 }}>{section.title}</div>
                  <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>{section.helper}</div>
                </div>
                <Badge label={String(section.items.length)} color={T.accent} />
              </div>
              {section.items.length === 0 ? (
                <div style={{ padding:"14px", fontSize:12, color:T.textDim }}>Aucune source dans cette section.</div>
              ) : (
                <div>
                  {section.items.slice(0, 4).map((source: any, index: number) => (
                    <div key={buildSourceKey(source)} style={{ display:"grid", gridTemplateColumns:"1.5fr 90px 90px 1fr 1fr 100px", gap:10, padding:"12px 14px", borderTop:index === 0 ? "none" : `1px solid ${T.border}`, alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700 }}>{source.code}</div>
                        {source._type === "bottle" && <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>{source.formatLabel} - conversion {BOTTLE_FORMAT_TO_HL[source.formatCode] || 0} hL / unité</div>}
                      </div>
                      <div style={{ fontSize:12, color:T.text }}>{source.cepage || source.mainGrapeCode || source.sourceLot?.mainGrapeCode || "--"}</div>
                      <div style={{ fontSize:12, color:T.text }}>{source.millesime || source.year || "--"}</div>
                      <div style={{ fontSize:12, color:T.textStrong }}>{source._type === "bottle" ? `${source.availableVolumeHl.toFixed(3)} hL` : `${Number(source.availableVolumeHl).toFixed(2)} hL`}</div>
                      <div style={{ fontSize:12, color:T.text }}>{source.currentContainerLabel || "--"}</div>
                      <div><Badge label={source.status} color={LOT_STATUS_COLORS[source.status] || T.textDim} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
