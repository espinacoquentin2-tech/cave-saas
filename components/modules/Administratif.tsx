"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, FF, Input, Select } from "@/components/ui";
import { useStore, useTheme } from "@/lib/store";

type AdministratifProps = {
  PerteCasseModal: React.ComponentType<{ onClose: () => void }>;
};

// =============================================================================
// ADMINISTRATIF & DOUANES (CAHIER DE PRESSOIR, DRM, EXPORTS)
// =============================================================================
export function Administratif({ PerteCasseModal }: AdministratifProps) {
  const T = useTheme();
  const { state } = useStore();
  const [tab, setTab] = useState("pressoir");
  const [modal, setModal] = useState(null);

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [drmMonth, setDrmMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // ==========================================
  // 1. LOGIQUE CAHIER DE PRESSOIR
  // ==========================================
  const pressings = (state.pressings || []) as any[];
  const years = [...new Set(pressings.map((p: any) => p.date ? p.date.split("-")[0] : ""))].filter(Boolean).sort((a: any,b: any) => Number(b) - Number(a));

  const activeYear = years.includes(year) ? year : (years[0] || new Date().getFullYear().toString());
  const filteredPressings = pressings
    .filter((p: any) => p.date && p.date.startsWith(activeYear))
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalKg = filteredPressings.reduce((sum: number, p: any) => sum + (parseFloat(p.weightKilos || p.weight) || 0), 0);
  const totalTheoCuvee = ((totalKg / 4000) * 20.5).toFixed(2);
  const totalTheoTaille = ((totalKg / 4000) * 5.0).toFixed(2);

  // ==========================================
  // 2. LOGIQUE DRM (REGISTRE DE CAVE)
  // ==========================================
  const [drmY, drmM] = drmMonth.split('-');
  const targetMonthStr = `${drmM}/${drmY}`;
  const currentMonthLabel = new Date(drmMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const drmEvents = (state.events || []).filter((e: any) => e.date.includes(targetMonthStr));
  const pertesMois = drmEvents.filter((e: any) => e.type === "PERTE" || e.type === "CASSE");
  const distillerieMois = drmEvents.filter((e: any) => e.type === "DISTILLERIE");

  const getVolSafe = (e: any) => {
    const vol = parseFloat(e.volumeOut || e.volumeIn || 0);
    if (vol > 0) return vol;
    return parseFloat(e.note?.match(/\d+(\.\d+)?/)?.[0] || 0);
  };

  const distilMoisHl = distillerieMois.reduce((s: number, e: any) => s + getVolSafe(e), 0);

  const getLotNameSafe = (e: any) => {
    const lot = state.lots?.find((l: any) => String(l.id) === String(e.lotId));
    if (lot) return lot.code;
    const bLot = state.bottleLots?.find((b: any) => String(b.id) === String(e.lotId));
    return bLot ? bLot.code : "Inconnu";
  };

  // ==========================================
  // 3. MOTEUR D'EXPORTS (CSV & PDF)
  // ==========================================

  // Fonction utilitaire pour déclencher le téléchargement d'un CSV
  const downloadCSV = (csvContent: string, fileName: string) => {
    // Le BOM (\uFEFF) force Excel à lire le fichier en UTF-8 (pour les accents)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPressoirCSV = () => {
    // Séparateur Point-Virgule pour Excel France
    let csv = "Date;N° Marc;Parcelle/Provenance;Cépage;Kilos;Degré;Destination\n";
    filteredPressings.forEach((p: any) => {
      const dateStr = new Date(p.date).toLocaleDateString('fr-FR');
      const marc = p.marcNumber || "";
      const parcelle = p.parcelleName || p.provenance || "";
      const cepage = p.cepage || "";
      const kilos = p.weightKilos || p.weight || 0;
      const degre = p.potentialAlc || "";
      const dest = p.destinationTank || "";
      csv += `${dateStr};${marc};${parcelle};${cepage};${kilos};${degre};${dest}\n`;
    });
    downloadCSV(csv, `Cahier_Pressoir_${activeYear}.csv`);
  };

  const exportDrmCSV = () => {
    let csv = "Date;Type de Sortie;Lot concerne;Quantite Sortie;Unite;Motif/Destinataire;Operateur\n";

    distillerieMois.forEach((e: any) => {
      const dateStr = e.date.split(" à ")[0];
      const note = e.note?.replace("[DISTILLERIE] Motif: ", "") || "";
      csv += `${dateStr};DISTILLERIE;${getLotNameSafe(e)};${getVolSafe(e)};hL;${note};${e.operator}\n`;
    });

    pertesMois.forEach((e: any) => {
      const dateStr = e.date.split(" à ")[0];
      const unite = e.type === "CASSE" ? "Bouteilles" : "hL";
      csv += `${dateStr};${e.type};${getLotNameSafe(e)};${getVolSafe(e)};${unite};${e.note};${e.operator}\n`;
    });

    downloadCSV(csv, `DRM_Sorties_${drmMonth}.csv`);
  };

  const exportPDF = () => {
    // Déclenche la fenêtre d'impression native du navigateur
    window.print();
  };

  return (
    <div className="admin-container">
      {/* RÈGLES D'IMPRESSION (Masque les menus lors de l'export PDF) */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .admin-container, .admin-container * { visibility: visible; }
          .admin-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-header { font-size: 24px !important; margin-bottom: 20px !important; color: #000 !important; }
        }
      `}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <h1 className="print-header" style={{ fontFamily:"'Playfair Display', serif", fontSize:32, color:T.textStrong, margin:0 }}>
          {tab === "pressoir" ? `Cahier de Pressoir - ${activeYear}` : `Registre de Cave - ${currentMonthLabel}`}
        </h1>

        {/* BOUTONS CACHÉS À L'IMPRESSION */}
        <div className="no-print" style={{ display:"flex", gap: 10 }}>
          <button onClick={() => setTab("pressoir")} style={{ background: tab==="pressoir" ? T.accent : "transparent", color: tab==="pressoir" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 4, fontSize: 11, fontWeight: "bold", cursor: "pointer", transition:"all .2s" }}>
            CAHIER DE PRESSOIR
          </button>
          <button onClick={() => setTab("drm")} style={{ background: tab==="drm" ? T.accent : "transparent", color: tab==="drm" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 4, fontSize: 11, fontWeight: "bold", cursor: "pointer", transition:"all .2s" }}>
            REGISTRE DE CAVE (DRM)
          </button>
        </div>
      </div>

      {/* --- VUE CAHIER DE PRESSOIR --- */}
      {tab === "pressoir" && (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

          <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.surfaceHigh, padding:20, borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", gap:24, alignItems:"center" }}>
              <FF label="Année de récolte">
                <Select value={activeYear} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(e.target.value)} style={{ width:120 }}>
                  {years.length > 0 ? (years as any[]).map((y: any) => <option key={y} value={y}>{y}</option>) : <option value={year}>{year}</option>}
                </Select>
              </FF>
              <div style={{ height:30, width:1, background:T.border }} />
              <div>
                <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", marginBottom:4 }}>Total Kilos {activeYear}</div>
                <div style={{ fontSize:18, color:T.accentLight, fontWeight:"bold" }}>{totalKg.toLocaleString()} kg</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:16, alignItems: "center" }}>
              <Btn variant="secondary" onClick={exportPressoirCSV}>📥 Exporter CSV</Btn>
              <Btn variant="secondary" onClick={exportPDF}>📄 Imprimer PDF</Btn>
            </div>
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
             <div style={{ display: "grid", gridTemplateColumns: "100px 100px 1.5fr 1fr 100px 80px 1fr", padding: "12px 20px", background: T.surfaceHigh, borderBottom: `2px solid ${T.border}`, fontSize: 10, fontWeight: "bold", color: T.textDim, textTransform: "uppercase" }}>
                <div>Date</div><div>N° Marc</div><div>Parcelle</div><div>Cépage</div><div style={{textAlign:"right"}}>Kilos</div><div style={{textAlign:"right"}}>Dég.</div><div>Destination</div>
             </div>
             {filteredPressings.map((p: any, i: number) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "100px 100px 1.5fr 1fr 100px 80px 1fr", padding: "14px 20px", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: i%2===0?"transparent":T.surfaceHigh+"44", fontSize: 13 }}>
                   <div style={{ color:T.textDim }}>{new Date(p.date).toLocaleDateString('fr-FR').slice(0,5)}</div>
                   <div style={{ fontFamily:"monospace", fontWeight:"bold" }}>{p.marcNumber || `M-${i+1}`}</div>
                   <div style={{ fontWeight:"500" }}>{p.parcelleName || p.provenance}</div>
                   <div style={{ color:T.textDim }}>{p.cepage}</div>
                   <div style={{ textAlign:"right", fontWeight:"bold" }}>{p.weightKilos?.toLocaleString()}</div>
                   <div style={{ textAlign:"right", color:T.accent }}>{p.potentialAlc}°</div>
                   <div style={{ textAlign:"right", fontSize:11, color:T.textDim }}>{p.destinationTank || "En pressoir"}</div>
                </div>
             ))}
             {/* Total visible à l'impression */}
             <div style={{ padding: "16px 20px", background: T.surfaceHigh, borderTop: `2px solid ${T.border}`, textAlign: "right" }}>
                <span style={{ fontSize: 12, textTransform: "uppercase", color: T.textDim, marginRight: 16 }}>Poids Total :</span>
                <span style={{ fontSize: 16, fontWeight: "bold", color: T.textStrong }}>{totalKg.toLocaleString()} kg</span>
             </div>
          </div>
        </div>
      )}

      {/* --- VUE DRM --- */}
      {tab === "drm" && (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong }}>Période :</span>
              <Input type="month" value={drmMonth} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDrmMonth(e.target.value)} style={{ width: 170 }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
               <Btn variant="secondary" onClick={exportDrmCSV}>📥 Exporter CSV</Btn>
               <Btn variant="secondary" onClick={exportPDF}>📄 Imprimer PDF</Btn>
            </div>
          </div>

          {/* Section Distillerie */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: T.textStrong, textTransform: "uppercase", letterSpacing: 1 }}>Sorties Distillerie</div>
              <div style={{ fontSize: 14, fontWeight: "bold", color: "#d98b2b", fontFamily: "monospace" }}>Total : -{distilMoisHl.toFixed(2)} hL</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"120px 150px 100px 1fr 120px", padding:"10px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase" }}>
              <div>Date</div><div>Lot</div><div>Quantité</div><div>Motif</div><div>Opérateur</div>
            </div>
            {distillerieMois.length === 0 ? <div style={{ padding:30, textAlign:"center", color:T.textDim }}>Aucun mouvement ce mois-ci.</div> :
              distillerieMois.map((e: any) => (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:"120px 150px 100px 1fr 120px", padding:"14px 16px", borderBottom:`1px solid ${T.border}`, fontSize:12 }}>
                  <div style={{ color:T.textDim }}>{e.date.split(" à ")[0]}</div>
                  <div style={{ fontWeight:"bold" }}>{getLotNameSafe(e)}</div>
                  <div style={{ color:"#d98b2b", fontWeight:"bold" }}>-{getVolSafe(e)} hL</div>
                  <div>{e.note?.replace("[DISTILLERIE] Motif: ", "")}</div>
                  <div style={{ color:T.textDim }}>{e.operator}</div>
                </div>
              ))
            }
          </div>

          {/* Section Pertes */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: T.textStrong, textTransform: "uppercase", letterSpacing: 1 }}>Pertes & Casses déclarées</div>
                <Btn className="no-print" onClick={() => setModal("perte" as any)} style={{ background:T.red, borderColor:T.red, color:"#fff" }}>⚠️ Déclarer Perte</Btn>
             </div>
             <div style={{ display:"grid", gridTemplateColumns:"120px 80px 150px 100px 1fr 120px", padding:"10px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase" }}>
                <div>Date</div><div>Type</div><div>Lot</div><div>Quantité</div><div>Motif</div><div>Opérateur</div>
             </div>
             {pertesMois.length === 0 ? <div style={{ padding:30, textAlign:"center", color:T.textDim }}>Aucune perte déclarée.</div> :
               pertesMois.map((e: any) => (
                 <div key={e.id} style={{ display:"grid", gridTemplateColumns:"120px 80px 150px 100px 1fr 120px", padding:"14px 16px", borderBottom:`1px solid ${T.border}`, fontSize:12 }}>
                   <div style={{ color:T.textDim }}>{e.date.split(" à ")[0]}</div>
                   <div><Badge label={e.type} color={T.red} /></div>
                   <div style={{ fontWeight:"bold" }}>{getLotNameSafe(e)}</div>
                   <div style={{ color:T.red, fontWeight:"bold" }}>-{getVolSafe(e)} {e.type === "CASSE" ? "btl" : "hL"}</div>
                   <div>{e.note}</div>
                   <div style={{ color:T.textDim }}>{e.operator}</div>
                 </div>
               ))
             }
          </div>
        </div>
      )}

      {modal === "perte" && <PerteCasseModal onClose={() => setModal(null)} />}
    </div>
  );
}
