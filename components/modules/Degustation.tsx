"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, Modal } from "@/components/ui";
import { useAuth, useStore, useTheme } from "@/lib/store";
import { getCurrentUserRoleKey, roleMatches } from "@/lib/roles";
import {
  BAIES_DATA_PREFIX,
  BAIES_LABELS,
  BAIES_RADAR_AXES,
  BAIES_TEXT_ORDER,
  PHASES_DEGUSTATION,
} from "@/components/modules/degustation/degustation.constants";

type DegustationProps = {
  DegustationModal: React.ComponentType<{
    onClose: () => void;
    defaultPhase?: string;
  }>;
};

export function Degustation({ DegustationModal }: DegustationProps) {
  const T = useTheme();
  const { user } = useAuth();
  const { state } = useStore();
  const [modal, setModal] = useState(false);
  const [activePhase, setActivePhase] = useState("BAIES");
  const [selectedDegustation, setSelectedDegustation] = useState<any | null>(null);
  const canWrite = !roleMatches(getCurrentUserRoleKey(user), ["LECTURE_SEULE"]);

  const degustations = state.degustations || [];
  
  // On filtre selon l'onglet actif et on trie de la plus récente à la plus ancienne
  const filteredData = degustations
    .filter((d: any) => d.phase === activePhase)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getTargetName = (d: any) => {
    if (d.parcelle) return d.parcelle;
    if (d.lotId) {
      const l = state.lots?.find((x: any) => String(x.id) === String(d.lotId));
      return l ? l.code : `Lot #${d.lotId}`;
    }
    if (d.bottleLotId) {
      const b = state.bottleLots?.find((x: any) => String(x.id) === String(d.bottleLotId));
      return b ? b.code : `Bouteilles #${d.bottleLotId}`;
    }
    return "Cible inconnue";
  };

  const parseBaiesData = (notes?: string | null) => {
    if (!notes || !notes.startsWith(BAIES_DATA_PREFIX)) return null;
    const [jsonPart, ...rest] = notes.slice(BAIES_DATA_PREFIX.length).split('\n');
    try {
      const parsed = JSON.parse(jsonPart);
      return { data: parsed, freeNote: rest.join('\n') };
    } catch {
      return null;
    }
  };

  const formatBaiesValue = (k: string, v: any) => {
    if (!v) return '-';
    if (k !== 'vendange') return String(v);
    const legacyMap: Record<string, string> = {
      'À attendre': 'Plus d’une semaine',
      'Dans 3-5 jours': 'Dans quelques jours',
      'Vendange immédiate': 'Prêt à vendanger',
    };
    return legacyMap[String(v)] || String(v);
  };

  const getBaiesLabel = (key: string) => BAIES_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  const getBaiesRadarLabel = (key: string) => {
    if (key === "aromePellicule") return "Arômes pel.";
    if (key === "astringencePellicule") return "Astringence pel.";
    return getBaiesLabel(key);
  };

  const getConclusion = (d: any) => {
    if (d.phase === "BAIES") {
      const parsed = parseBaiesData(d.notes);
      return (parsed?.freeNote || '').trim() || '-';
    }
    return String(d.notes || '').trim() || '-';
  };

  const getBaiesRadarPoints = (data: Record<string, any>) => {
    const cx = 110;
    const cy = 110;
    const radius = 82;
    return BAIES_RADAR_AXES.map((key, index) => {
      const raw = Number(data?.[key]);
      const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 10)) / 10 : 0;
      const angle = (Math.PI * 2 * index) / BAIES_RADAR_AXES.length - Math.PI / 2;
      const r = radius * normalized;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
  };

  const exportDegustationCsv = (d: any) => {
    const baies = d.phase === "BAIES" ? parseBaiesData(d.notes) : null;
    const rows = [
      ["id", d.id],
      ["date", new Date(d.date).toISOString().slice(0, 10)],
      ["phase", d.phase],
      ["element", getTargetName(d)],
      ["noteGlobale", d.noteGlobale ?? ""],
      ["robe", d.robe ?? ""],
      ["nez", d.nez ?? ""],
      ["bouche", d.bouche ?? ""],
      ["sucreTest", d.sucreTest ?? ""],
      ["notes", getConclusion(d)],
      ["operator", d.operator ?? ""],
    ];
    Object.entries(baies?.data || {}).forEach(([k, v]) => rows.push([`baies_${k}`, String(v ?? "")]));
    const csv = rows.map(([k, v]) => `"${String(k).replaceAll('"', '""')}","${String(v ?? "").replaceAll('"', '""')}"`).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `degustation-${d.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printDegustationPdf = (d: any) => {
    const baies = d.phase === "BAIES" ? parseBaiesData(d.notes) : null;
    const win = window.open('', '_blank');
    if (!win) return;
    const details = d.phase === "BAIES"
      ? Object.entries(baies?.data || {}).map(([k, v]) => `<li><strong>${getBaiesLabel(k)}</strong>: ${formatBaiesValue(k, v)}</li>`).join('')
      : `
        <li><strong>Visuel</strong>: ${d.robe || '-'}</li>
        <li><strong>Nez</strong>: ${d.nez || '-'}</li>
        <li><strong>Bouche</strong>: ${d.bouche || '-'}</li>
      `;
    win.document.write(`
      <html><head><title>Fiche dégustation</title></head><body style="font-family: Arial, sans-serif; padding:24px;">
      <h2>Fiche dégustation</h2>
      <p><strong>Élément</strong>: ${getTargetName(d)}</p>
      <p><strong>Date</strong>: ${new Date(d.date).toLocaleDateString('fr-FR')}</p>
      <p><strong>Phase</strong>: ${d.phase}</p>
      <p><strong>Note</strong>: ${d.noteGlobale ?? '-'}/20</p>
      <ul>${details}</ul>
      <p><strong>Conclusion</strong>: ${getConclusion(d)}</p>
      <p><strong>Opérateur</strong>: ${d.operator || '-'}</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Dégustation</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Carnet de suivi sensoriel standardisé (Arborescence V5 Fizz).</div>
        </div>
        {canWrite && <Btn onClick={() => setModal(true)}>+ Nouvelle Note</Btn>}
      </div>

      {/* ONGLETS DES PHASES */}
      <div style={{ display:"flex", gap:10, borderBottom:`1px solid ${T.border}`, paddingBottom:16, marginBottom:24, overflowX:"auto" }}>
        {PHASES_DEGUSTATION.map((p: any) => (
          <button 
            key={p.id} 
            onClick={() => setActivePhase(p.id)}
            style={{ 
              padding:"8px 16px", borderRadius:20, fontSize:13, fontWeight:"bold", cursor:"pointer", transition:"all 0.2s", whiteSpace:"nowrap",
              background: activePhase === p.id ? T.accent+"20" : "transparent",
              color: activePhase === p.id ? T.accent : T.textDim,
              border: `1px solid ${activePhase === p.id ? T.accent : T.border}`
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {filteredData.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>
          Aucune dégustation enregistrée pour cette phase.
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px", gap: 12, padding: "10px 14px", fontSize: 11, textTransform: "uppercase", fontWeight: "bold", color: T.textDim, borderBottom: `1px solid ${T.border}` }}>
            <div>Élément</div><div>Date</div><div>Phase</div><div style={{ textAlign: "right" }}>Note</div>
          </div>
          {filteredData.map((d: any, i: number) => (
            <button key={d.id} type="button" onClick={() => setSelectedDegustation(d)} style={{ width: "100%", textAlign: "left", border: "none", background: i % 2 === 0 ? "transparent" : `${T.surfaceHigh}`, borderBottom: i < filteredData.length - 1 ? `1px solid ${T.border}` : "none", padding: "12px 14px", cursor: "pointer" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px", gap: 12, alignItems: "center" }}>
                <div style={{ color: T.textStrong, fontWeight: "bold" }}>{getTargetName(d)}</div>
                <div style={{ color: T.textDim, fontSize: 12 }}>{new Date(d.date).toLocaleDateString('fr-FR')}</div>
                <div><Badge label={d.phase} color={T.accent} /></div>
                <div style={{ textAlign: "right", color: T.textStrong, fontFamily: "monospace", fontWeight: "bold" }}>{d.noteGlobale ? `${d.noteGlobale}/20` : "-"}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedDegustation && (
        <Modal title="Fiche dégustation" onClose={() => setSelectedDegustation(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: "bold", color: T.textStrong }}>{getTargetName(selectedDegustation)}</div>
              <div style={{ fontSize: 12, color: T.textDim }}>
                {new Date(selectedDegustation.date).toLocaleDateString('fr-FR')} • {selectedDegustation.phase}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: "bold", color: T.accentLight }}>{selectedDegustation.noteGlobale ?? "-"} /20</div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => exportDegustationCsv(selectedDegustation)}
              style={{
                border: `1px solid ${T.accent}55`,
                background: T.surfaceHigh,
                color: T.accentLight,
                borderRadius: 6,
                padding: "10px 18px",
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              📥&nbsp; Exporter CSV
            </button>
            <button
              type="button"
              onClick={() => printDegustationPdf(selectedDegustation)}
              style={{
                border: `1px solid ${T.accent}55`,
                background: T.surfaceHigh,
                color: T.accentLight,
                borderRadius: 6,
                padding: "10px 18px",
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              🖨️&nbsp; Imprimer PDF
            </button>
          </div>
          {selectedDegustation.phase === "BAIES" && parseBaiesData(selectedDegustation.notes) ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", background: T.surfaceHigh, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ padding: "8px 10px", fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Critère</div>
                  <div style={{ padding: "8px 10px", fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, borderLeft: `1px solid ${T.border}` }}>Valeur</div>
                </div>
                {(() => {
                  const baiesData = parseBaiesData(selectedDegustation.notes)?.data || {};
                  return BAIES_TEXT_ORDER.filter((k) => k in baiesData).map((k, idx) => (
                    <div key={k} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", background: idx % 2 ? T.surfaceHigh : "transparent", borderBottom: idx < BAIES_TEXT_ORDER.filter((x) => x in baiesData).length - 1 ? `1px solid ${T.border}88` : "none" }}>
                      <div style={{ padding: "8px 10px", fontSize: 12, color: T.textDim }}>{getBaiesLabel(k)}</div>
                      <div style={{ padding: "8px 10px", fontSize: 12, color: T.textStrong, borderLeft: `1px solid ${T.border}88` }}>{formatBaiesValue(k, baiesData[k])}</div>
                    </div>
                  ));
                })()}
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, background: T.surfaceHigh, width: "100%" }}>
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Radar BAIES</div>
                <div style={{ maxWidth: 420, margin: "0 auto" }}>
                  <svg viewBox="0 0 220 220" width="100%" height="200" role="img" aria-label="Graphique radar BAIES">
                    {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => {
                      const cx = 110;
                      const cy = 110;
                      const radius = 82 * scale;
                      const points = BAIES_RADAR_AXES.map((_, index) => {
                        const angle = (Math.PI * 2 * index) / BAIES_RADAR_AXES.length - Math.PI / 2;
                        return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
                      }).join(' ');
                      return <polygon key={scale} points={points} fill="none" stroke={i === 4 ? `${T.border}CC` : `${T.border}88`} strokeWidth={i === 4 ? "1.2" : "1"} />;
                    })}
                    {[2, 4, 6, 8, 10].map((value) => (
                      <text key={value} x={113} y={110 - (82 * value / 10)} fontSize="8" fill={T.textDim} textAnchor="start" dominantBaseline="central">
                        {value}
                      </text>
                    ))}
                    {BAIES_RADAR_AXES.map((key, index) => {
                      const cx = 110;
                      const cy = 110;
                      const radius = 100;
                      const angle = (Math.PI * 2 * index) / BAIES_RADAR_AXES.length - Math.PI / 2;
                      const x = cx + radius * Math.cos(angle);
                      const y = cy + radius * Math.sin(angle);
                      const anchor = Math.cos(angle) > 0.3 ? "start" : Math.cos(angle) < -0.3 ? "end" : "middle";
                      return (
                        <text key={key} x={x} y={y} fontSize="9" fill={T.textDim} textAnchor={anchor} dominantBaseline="central">
                          {getBaiesRadarLabel(key)}
                        </text>
                      );
                    })}
                    <polygon points={getBaiesRadarPoints(parseBaiesData(selectedDegustation.notes)?.data || {})} fill={`${T.accent}55`} stroke={T.accentLight} strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14, fontSize: 12 }}>
              <div><strong>Visuel :</strong> {selectedDegustation.robe || "-"}</div>
              <div><strong>Dosage :</strong> {selectedDegustation.sucreTest ? `${selectedDegustation.sucreTest} g/L` : "-"}</div>
              <div><strong>Nez :</strong> {selectedDegustation.nez || "-"}</div>
              <div><strong>Bouche :</strong> {selectedDegustation.bouche || "-"}</div>
            </div>
          )}
          <div style={{ fontSize: 12, color: T.text }}>
            <strong>{selectedDegustation.phase === "BAIES" ? "Notes :" : "Conclusion :"}</strong> {getConclusion(selectedDegustation)}
          </div>
        </Modal>
      )}

      {modal && <DegustationModal onClose={() => setModal(false)} defaultPhase={activePhase} />}
    </div>
  );
}
