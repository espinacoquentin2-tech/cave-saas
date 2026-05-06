"use client";
// @ts-nocheck

import React, { useState } from "react";
import { useTheme } from "@/lib/store";

export function MaturationGraphModal({ data, title, onClose }: { data: any[]; title: string; onClose: () => void }) {
  const T = useTheme();
  
  const config: Record<string, { label: string; color: string; isDashed?: boolean }> = {
    sucre: { label: "Sucre (g/L)", color: "#f59e0b" },
    tavp: { label: "TAVP (°)", color: "#3b82f6" },
    dyn: { label: "Dynamique (°/j)", color: "#10b981", isDashed: true },
    at: { label: "AT", color: "#ec4899" },
    ph: { label: "pH", color: "#8b5cf6" },
    indice: { label: "Indice Mat.", color: "#06b6d4" },
    maladie: { label: "État Sanitaire (%)", color: T.red, isDashed: true } 
  };
  
  const [activeMetrics, setActiveMetrics] = useState<string[]>(['tavp', 'maladie']);

  const toggleMetric = (m: string) => {
    if (activeMetrics.includes(m)) setActiveMetrics(activeMetrics.filter(x => x !== m));
    else setActiveMetrics([...activeMetrics, m]);
  };

  const chartData = data.map((r: any, i: number) => {
    let dyn = null;
    if (i > 0 && r.tavp && data[i-1].tavp) {
      const prev = data[i - 1];
      const days = (new Date(r.date).getTime() - new Date(prev.date).getTime()) / (1000 * 3600 * 24);
      if (days > 0) dyn = (parseFloat(r.tavp) - parseFloat(prev.tavp)) / days;
    }

    const isSain = !r.maladie || r.maladie === "Aucune";

    return {
      date: new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      sucre: r.sucre ? parseFloat(r.sucre).toFixed(1) : null,
      tavp: r.tavp ? parseFloat(r.tavp).toFixed(1) : null,
      dyn: dyn ? dyn.toFixed(2) : null,
      at: r.at ? parseFloat(r.at).toFixed(1) : null,
      ph: r.ph ? parseFloat(r.ph).toFixed(2) : null,
      indice: (r.sucre && r.at) ? (parseFloat(r.sucre) / parseFloat(r.at)).toFixed(1) : null,
      maladie: isSain ? 0 : (parseFloat(r.intensite) || 0),
      maladieName: isSain ? "Sain" : r.maladie
    };
  });

  const W = 900; 
  const H = 400;
  const padLeft = 60; 
  const padRight = 60; 
  const padTop = 40; 
  const padBottom = 50; 

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div style={{ background: T.surface, width: "100%", maxWidth: 900, borderRadius: 8, boxShadow: "0 10px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", border: `1px solid ${T.border}` }}>
        
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surfaceHigh, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: T.textStrong, fontFamily: "'Playfair Display', serif" }}>Graphique : {title}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textDim, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {Object.entries(config).map(([key, val]) => {
              const isActive = activeMetrics.includes(key);
              return (
                <button key={key} onClick={() => toggleMetric(key)}
                  style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: "bold", border: `1px solid ${isActive ? val.color : T.border}`, background: isActive ? val.color + "20" : "transparent", color: isActive ? val.color : T.textDim, cursor: "pointer", transition: "all 0.2s" }}>
                  {isActive ? "✓ " : ""}{val.label}
                </button>
              );
            })}
          </div>

          <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 0" }}>
            {chartData.length < 2 ? (
              <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim }}>Pas assez de prélèvements pour tracer une courbe.</div>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
                
                {[0, 1, 2, 3, 4].map(i => {
                  const y = padTop + (i * (H - padTop - padBottom) / 4);
                  return <line key={`grid-${i}`} x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke={T.border} strokeDasharray="4 4" opacity={0.5} />;
                })}
                
                <line x1={padLeft} y1={padTop - 10} x2={padLeft} y2={H - padBottom} stroke={T.textDim} strokeWidth={1.5} />
                <line x1={padLeft} y1={H - padBottom} x2={W - padRight + 10} y2={H - padBottom} stroke={T.textDim} strokeWidth={1.5} />

                {chartData.map((d: any, i: number) => {
                  const x = padLeft + (i * (W - padLeft - padRight) / (chartData.length - 1));
                  return (
                    <g key={`x-${i}`}>
                      <line x1={x} y1={H - padBottom} x2={x} y2={H - padBottom + 6} stroke={T.textDim} strokeWidth={1.5} />
                      <line x1={x} y1={padTop} x2={x} y2={H - padBottom} stroke={T.border} strokeDasharray="2 2" opacity={0.3} />
                      <text x={x} y={H - padBottom + 24} fontSize={12} fill={T.textDim} textAnchor="middle" fontWeight="bold">{d.date}</text>
                    </g>
                  );
                })}

                {/* Tracé de toutes les courbes actives */}
                {activeMetrics.map((metric, mIdx) => {
                  const conf = config[metric];
                  const values = chartData.map((d: any) => parseFloat(d[metric])).filter((v: number) => !isNaN(v));
                  if (values.length < 2) return null;
                  
                  // L'échelle de la maladie part toujours de 0 et monte à au moins 10%
                  const minV = metric === 'maladie' ? 0 : Math.min(...values) * 0.90; 
                  const maxV = metric === 'maladie' ? Math.max(10, ...values) * 1.10 : Math.max(...values) * 1.10;

                  const getPoint = (val: number, index: number) => {
                    const x = padLeft + (index * (W - padLeft - padRight) / (chartData.length - 1));
                    const y = (H - padBottom) - ((val - minV) / (maxV - minV)) * (H - padTop - padBottom);
                    return { x, y };
                  };

                  let pathD = "";
                  const points: Array<{ x: number; y: number; val: any; yOffset: number; maladieName: string }> = [];
                  chartData.forEach((d: any, i: number) => {
                    if (d[metric] !== null && d[metric] !== undefined) {
                      const pt = getPoint(parseFloat(d[metric]), i);
                      let yOffset = mIdx % 2 === 0 ? -16 : 24; 
                      if (metric === 'maladie' && parseFloat(d[metric]) === 0) yOffset = -12; // Sain s'affiche au-dessus de la ligne 0
                      
                      points.push({ ...pt, val: d[metric], yOffset, maladieName: d.maladieName });
                      pathD += pathD === "" ? `M ${pt.x} ${pt.y} ` : `L ${pt.x} ${pt.y} `;
                    }
                  });

                  return (
                    <g key={`curve-${metric}`}>
                      {/* La ligne directrice */}
                      <path d={pathD} fill="none" stroke={conf.color} strokeWidth={3} strokeLinejoin="round" strokeDasharray={conf.isDashed ? "8 6" : "none"} opacity={metric === 'maladie' ? 0.6 : 1} />
                      
                      {/* Les points et étiquettes */}
                      {points.map((pt, i) => {
                        let ptColor = conf.color;
                        let displayVal = pt.val;

                        // Intelligence spécifique pour la courbe de maladie
                        if (metric === 'maladie') {
                          if (pt.val === 0) {
                            ptColor = T.green;
                            displayVal = "Sain";
                          } else {
                            if (pt.maladieName === "Mildiou") ptColor = "#8c3b3b";
                            else if (pt.maladieName === "Oïdium") ptColor = "#a8a8a8";
                            else ptColor = T.red;
                            
                            let abbr = "";
                            if (pt.maladieName === "Pourriture Grise") abbr = "PG";
                            else if (pt.maladieName === "Mildiou") abbr = "MIL";
                            else if (pt.maladieName === "Oïdium") abbr = "OID";
                            
                            displayVal = `${pt.val}% ${abbr}`;
                          }
                        }

                        return (
                          <g key={`pt-${i}`}>
                            <circle cx={pt.x} cy={pt.y} r={metric === 'maladie' && pt.val === 0 ? 3 : 5} fill={T.surface} stroke={ptColor} strokeWidth={2.5} />
                            <text x={pt.x} y={pt.y + pt.yOffset} fontSize={11} fill={ptColor} fontWeight="bold" textAnchor="middle">
                              {displayVal}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
          
          {/* Légende des maladies */}
          {activeMetrics.includes('maladie') && (
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: T.red, borderRadius: 2 }} /> Pourriture Grise</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: "#8c3b3b", borderRadius: 2 }} /> Mildiou</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: "#a8a8a8", borderRadius: 2 }} /> Oïdium</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: T.green, borderRadius: 2 }} /> Sain</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
