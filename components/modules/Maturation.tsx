"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Btn, Select } from "@/components/ui";
import { CHAMPAGNE_GEODATA } from "@/lib/geodata";
import { useStore, useTheme } from "@/lib/store";

type MaturationProps = {
  MaturationModal: React.ComponentType<{ editData?: any; onClose: () => void }>;
  MaturationGraphModal: React.ComponentType<{ data: any[]; title: string; onClose: () => void }>;
};

export function Maturation({ MaturationModal, MaturationGraphModal }: MaturationProps) {
  const T = useTheme();
  const { state } = useStore();

  const [modalData, setModalData] = useState<any | null>(null);
  const [graphData, setGraphData] = useState<any | null>(null);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear().toString());

  const [exportSelection, setExportSelection] = useState<any[]>([]);
  const [expDep, setExpDep] = useState("");
  const [expReg, setExpReg] = useState("");
  const [expCom, setExpCom] = useState("");

  const maturations = state.maturations || [];

  const currentYear = new Date().getFullYear().toString();
  const availableYears = maturations.map((m: any) => m.date ? m.date.substring(0, 4) : "").filter(Boolean);
  const displayYears = [...new Set([currentYear, activeYear, ...availableYears])].sort((a: any,b: any) => Number(b) - Number(a));

  const dataForYear = maturations
    .filter((m: any) => m.date && m.date.startsWith(activeYear))
    .sort((a: any,b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const parcelles: Record<string, any[]> = {};
  dataForYear.forEach((m: any) => {
    const key = `${m.parcelle} (${m.cepage})`;
    if (!parcelles[key]) parcelles[key] = [];
    parcelles[key].push(m);
  });

  const allParcelleKeys = Object.keys(parcelles);

  const parcelleGeoMap: Record<string, any> = {};
  (state.parcelles || []).forEach((p: any) => { parcelleGeoMap[p.nom] = p; });

  const filteredParcelleKeys = allParcelleKeys.filter((key: any) => {
    const nomParcelle = parcelles[key][0].parcelle;
    const geo = parcelleGeoMap[nomParcelle] || {};

    if (expDep && geo.departement !== expDep) return false;
    if (expReg && geo.region !== expReg) return false;
    if (expCom && geo.commune !== expCom) return false;
    return true;
  });

  const depts = Object.keys(CHAMPAGNE_GEODATA || {});
  const regions = expDep ? Object.keys((CHAMPAGNE_GEODATA as any)[expDep] || {}) : [];
  const communes = (expDep && expReg) ? ((CHAMPAGNE_GEODATA as any)[expDep]?.[expReg] || []) : [];

  const toggleExportSelection = (key: any) => {
    if (exportSelection.includes(key)) setExportSelection(exportSelection.filter((k: any) => k !== key));
    else setExportSelection([...exportSelection, key]);
  };

  const selectAllFiltered = () => {
    const allFilteredSelected = filteredParcelleKeys.length > 0 && filteredParcelleKeys.every((k: any) => exportSelection.includes(k));
    if (allFilteredSelected) {
      setExportSelection(exportSelection.filter((k: any) => !filteredParcelleKeys.includes(k)));
    } else {
      const newSelection = new Set([...exportSelection, ...filteredParcelleKeys]);
      setExportSelection(Array.from(newSelection));
    }
  };

  const getExportData = () => {
    let dataToExport: any[] = [];
    (exportSelection.length > 0 ? exportSelection : filteredParcelleKeys).forEach((key: any) => {
      dataToExport = [...dataToExport, ...parcelles[key]];
    });
    return dataToExport.sort((a: any,b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const exportCSV = () => {
    const data = getExportData();
    if (data.length === 0) return alert("Aucune donnée à exporter.");
    const rows = [["Date", "Parcelle", "Cépage", "Sucre (g/L)", "TAVP (°)", "AT", "pH", "Maladie", "Intensité"].join(";")];
    data.forEach((r: any) => {
      const d = new Date(r.date);
      const shortDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      rows.push([
        shortDate, r.parcelle, r.cepage, r.sucre || "",
        r.tavp ? r.tavp.toFixed(2) : "", r.at || "", r.ph || "",
        r.maladie || "", r.intensite || ""
      ].join(";"));
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Maturation_${activeYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportPDF = () => {
    const data = getExportData();
    if (data.length === 0) return alert("Aucune donnée à exporter.");
    const html = `
      <!DOCTYPE html><html><head><title>Maturation ${activeYear}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        th { background-color: #f5f5f5; }
      </style></head><body>
      <h1>Suivi de Maturation - ${activeYear}</h1>
      <table><tr><th>Date</th><th>Parcelle</th><th>Cépage</th><th>Sucre</th><th>TAVP</th><th>AT</th><th>pH</th><th>État Sanitaire</th></tr>
      ${data.map((r: any) => {
        const d = new Date(r.date);
        const shortDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return `<tr>
          <td><strong>${shortDate}</strong></td><td><strong>${r.parcelle}</strong></td><td>${r.cepage}</td>
          <td>${r.sucre || "-"}</td><td>${r.tavp ? r.tavp.toFixed(1) : "-"}</td>
          <td>${r.at || "-"}</td><td>${r.ph || "-"}</td>
          <td>${r.maladie !== "Aucune" ? r.maladie + (r.intensite ? ' '+r.intensite+'%' : '') : "Sain"}</td>
        </tr>`;
      }).join('')}
      </table></body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html); win.document.close(); win.print();
  };

  const getSanitaryStyle = (maladie: any, intensite: any) => {
    if (!maladie || maladie === "Aucune") return { color: T.green, bg: "transparent", border: "transparent" };
    const num = parseFloat(intensite) || 0;
    if (!intensite) return { color: T.red, bg: T.red + "22", border: T.red };
    if (num >= 10) return { color: T.red, bg: T.red + "22", border: T.red };
    if (num >= 5)  return { color: "#d98b2b", bg: "#d98b2b22", border: "#d98b2b" };
    return { color: T.green, bg: T.green + "11", border: T.green + "55" };
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Maturation</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Réseau de maturation et contrôles sanitaires.</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Select value={activeYear} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActiveYear(e.target.value)} style={{ width: 100, fontWeight: "bold", cursor:"pointer" }}>
            {displayYears.map((y: any) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Btn onClick={() => setModalData("new" as any)} >+ Nouveau Prélèvement</Btn>
        </div>
      </div>

      {allParcelleKeys.length > 0 && (
        <div style={{ background: T.surfaceHigh, padding: "16px 24px", borderRadius: 6, border: `1px solid ${T.border}`, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Filtres géographiques & Export</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ width: "100%" }}>
                  <Select value={expDep} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setExpDep(e.target.value); setExpReg(""); setExpCom(""); setExportSelection([]); }}>
                    <option value="">Tous Départements</option>
                    {depts.map((d: any) => <option key={d}>{d}</option>)}
                  </Select>
                </div>
                <div style={{ width: "100%" }}>
                  <Select value={expReg} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setExpReg(e.target.value); setExpCom(""); setExportSelection([]); }} disabled={!expDep}>
                    <option value="">Toutes Régions</option>
                    {regions.map((r: any) => <option key={r}>{r}</option>)}
                  </Select>
                </div>
                <div style={{ width: "100%" }}>
                  <Select value={expCom} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setExpCom(e.target.value); setExportSelection([]); }} disabled={!expReg}>
                    <option value="">Toutes Communes</option>
                    {communes.map((c: any) => <option key={c}>{c}</option>)}
                  </Select>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <Btn variant="secondary" onClick={exportCSV} style={{ fontSize: 12, padding: "8px 12px" }}>📥 CSV</Btn>
              <Btn variant="secondary" onClick={exportPDF} style={{ fontSize: 12, padding: "8px 12px" }}>📄 PDF</Btn>
            </div>
          </div>

          <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sélection pour l'export ({filteredParcelleKeys.length})</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={selectAllFiltered}
	                style={{ padding: "4px 8px", fontSize: 11, borderRadius: 4, border: `1px solid ${T.border}`, background: filteredParcelleKeys.length > 0 && filteredParcelleKeys.every((k: any) => exportSelection.includes(k)) ? T.accent : "transparent", color: filteredParcelleKeys.length > 0 && filteredParcelleKeys.every((k: any) => exportSelection.includes(k)) ? "#fff" : T.textDim, cursor: "pointer" }}>
	                Tout Cocher
	              </button>
	              {filteredParcelleKeys.map((k: any) => (
                <button
                  key={k}
                  onClick={() => toggleExportSelection(k)}
                  style={{ padding: "4px 8px", fontSize: 11, borderRadius: 4, border: `1px solid ${exportSelection.includes(k) ? T.accent : T.border}`, background: exportSelection.includes(k) ? T.accent+"20" : "transparent", color: exportSelection.includes(k) ? T.accent : T.textDim, cursor: "pointer" }}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {allParcelleKeys.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>
          Aucun prélèvement enregistré pour cette année.
        </div>
      ) : filteredParcelleKeys.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>
          Aucune parcelle ne correspond à vos filtres géographiques.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {filteredParcelleKeys.map((name: any) => {
            const records = parcelles[name];
            return (
              <div key={name} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ background: T.surfaceHigh, padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 16, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 12 }}>
                    {name}
                    <button onClick={() => setGraphData({ title: name, records })} style={{ background: T.accent + "20", border: `1px solid ${T.accent}50`, color: T.accent, borderRadius: 4, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      📊 Voir la courbe
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{records.length} prélèvement(s)</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 90px 60px 60px 80px 1fr 40px", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", gap: 10 }}>
                  <div>Date</div><div>Sucre</div><div>TAVP</div><div>Dynamique</div><div>AT</div><div>pH</div><div>Indice</div><div>État Sanitaire</div><div></div>
                </div>

                {records.map((r: any, i: number) => {
                  let dynStr = "--";
                  let dynColor = T.textDim;

                  if (i > 0) {
                    const prev = records[i - 1];
                    const days = (new Date(r.date).getTime() - new Date(prev.date).getTime()) / (1000 * 3600 * 24);
                    if (days > 0 && r.tavp && prev.tavp) {
                      const delta = (r.tavp - prev.tavp) / days;
                      dynStr = `${delta > 0 ? '+' : ''}${delta.toFixed(2)} °/j`;
                      dynColor = delta >= 0.15 ? T.green : (delta > 0 ? T.accent : T.red);
                    }
                  }

                  const indiceMat = (r.sucre && r.at) ? (r.sucre / r.at).toFixed(1) : "--";
                  const hasMaladie = r.maladie && r.maladie !== "Aucune";

                  const sStyle = getSanitaryStyle(r.maladie, r.intensite);

                  return (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 90px 60px 60px 80px 1fr 40px", padding: "12px 20px", alignItems: "center", borderBottom: i < records.length - 1 ? `1px solid ${T.border}` : "none", gap: 10 }}>
                      <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace" }}>{new Date(r.date).toLocaleDateString('fr-FR')}</div>
                      <div style={{ fontSize: 13, color: T.textStrong, fontWeight: "bold" }}>{r.sucre ? `${r.sucre}` : "--"}</div>
                      <div style={{ fontSize: 13, color: T.accent, fontWeight: "bold" }}>{r.tavp ? r.tavp.toFixed(1) : "--"}</div>
                      <div style={{ fontSize: 12, color: dynColor, fontWeight: "bold" }}>{dynStr}</div>
                      <div style={{ fontSize: 12, color: T.text }}>{r.at || "--"}</div>
                      <div style={{ fontSize: 12, color: T.text }}>{r.ph || "--"}</div>
                      <div style={{ fontSize: 12, color: T.textDim }}>{indiceMat !== "--" ? `${indiceMat}` : "--"}</div>

                      <div>
                        {hasMaladie ? (
                           <div style={{
                            display: "inline-block",
                            color: sStyle.color,
                            background: sStyle.bg,
                            border: `1px solid ${sStyle.border}`,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            letterSpacing: "1px"
                          }}>
                            {`${r.maladie} ${r.intensite ? r.intensite+'%' : ''}`}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: T.green, fontWeight: "bold" }}>Sain</span>
                        )}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <button onClick={() => setModalData(r)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize: 14, opacity: 0.7 }} title="Compléter les analyses">✏️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {modalData && <MaturationModal editData={modalData === "new" ? null : modalData} onClose={() => setModalData(null)} />}
      {graphData && <MaturationGraphModal data={graphData.records} title={graphData.title} onClose={() => setGraphData(null)} />}
    </div>
  );
}
