"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, Input, MultiSelectDrop } from "@/components/ui";
import { CEPAGES, LOT_STATUS_COLORS, useStore, useTheme } from "@/lib/store";

export function Lots({ onSelectLot }: { onSelectLot: any }) {
  const T = useTheme();
  const { state } = useStore();

  const [tab, setTab] = useState("actifs");
  const [search, setSearch] = useState("");
  const [filterMillesimes, setFilterMillesimes] = useState([]);
  const [filterCepages, setFilterCepages] = useState([]);
  const [filterLieux, setFilterLieux] = useState([]);
  const [filterContainers, setFilterContainers] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);

  const GROUPS = {
    CUVES: ["CUVE_INOX", "CUVE_BETON", "CUVE_EMAIL", "CUVE_FIBRE", "CUVE_PLASTIQUE", "CUVE_DEBOURBAGE"],
    BOIS: ["BARRIQUE", "FOUDRE"],
    SOUS_PRODUITS: ["CUVE_BOURBES", "CUVE_LIES", "CUVE_REBECHES"],
  };

  const formatVolShort = (vol: any) => typeof vol === "number" ? `${vol.toFixed(1)} hL` : `${vol} hL`;
  const formatStatus = (s: any) => s ? s.replace(/_/g, " ") : "INCONNU";

  const unifiedLots = [
    ...(state.lots || []).map((l: any) => ({ ...l, _type: "bulk", code: l.businessCode || l.code, millesime: l.year || l.millesime, volume: l.currentVolume || l.volume, containerId: l.currentContainerId || l.containerId })),
    ...(state.bottleLots || []).map((b: any) => {
      const src = (state.lots || []).find((l: any) => l.id == b.sourceLotId);
      return {
        ...b,
        _type: "bottle",
        code: b.businessCode || b.code,
        millesime: src?.year || src?.millesime || "--",
        cepage: src?.mainGrapeCode || src?.cepage || "MULTI",
        lieu: b.locationZone || b.zone || "--",
        volume: b.currentBottleCount || b.currentCount,
        containerId: null,
        format: b.formatCode || b.format,
      };
    }),
  ];

  const uniqueMillesimes = [...new Set(unifiedLots.map(l => l.millesime))].filter(m => m && m !== "--").sort((a, b) => b - a).map(String);
  const uniqueLieux = [...new Set(unifiedLots.map(l => l.lieu).filter(Boolean))].filter(l => l !== "--").sort();
  const uniqueStatuses = [...new Set(unifiedLots.map(l => l.status))].sort();

  const containerCategories = ["Cuves", "Bois", "Citernes", "Bouteilles", "Sous-produits", "Vrac (Sans contenant)", "Autre"];
  const selectedMillesimes = filterMillesimes as any[];
  const selectedCepages = filterCepages as any[];
  const selectedLieux = filterLieux as any[];
  const selectedContainers = filterContainers as any[];
  const selectedStatuses = filterStatuses as any[];

  const actifsCount = unifiedLots.filter(l => {
    const isDeadBulk = l._type === "bulk" && (l.volume <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(l.status));
    const isDeadBottle = l._type === "bottle" && l.volume <= 0;
    return !(isDeadBulk || isDeadBottle);
  }).length;

  const historiqueCount = unifiedLots.length - actifsCount;

  const filtered = unifiedLots.filter((l: any) => {
    const isDeadBulk = l._type === "bulk" && (l.volume <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(l.status));
    const isDeadBottle = l._type === "bottle" && l.volume <= 0;
    const isDead = isDeadBulk || isDeadBottle;

    if (tab === "actifs" && isDead) return false;
    if (tab === "historique" && !isDead) return false;

    const container = (l._type === "bulk" && !isDeadBulk) ? (state.containers || []).find((c: any) => c.id === l.containerId) : null;

    const matchSearch = !search || (l.code || "").toLowerCase().includes(search.toLowerCase());
    const matchMillesime = selectedMillesimes.length === 0 || selectedMillesimes.includes(l.millesime?.toString());
    const matchCepage = selectedCepages.length === 0 || selectedCepages.includes(l.cepage);
    const matchLieu = selectedLieux.length === 0 || selectedLieux.includes(l.lieu);
    const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(l.status);

    let matchContainer = true;
    if (selectedContainers.length > 0) {
      if (l._type === "bottle") {
        matchContainer = selectedContainers.includes("Bouteilles");
      } else if (!container) {
        matchContainer = selectedContainers.includes("Vrac (Sans contenant)");
      } else {
        const t = (container.type || "").toLowerCase();
        const n = ((container.displayName || container.name) || "").toLowerCase();
        const isSousProduit = GROUPS.SOUS_PRODUITS.includes(container.type) || t.includes("bourbe") || t.includes("lies") || t.includes("rebeche") || n.includes("bourbe") || n.includes("lies") || n.includes("rebeche");

        if (isSousProduit) {
          matchContainer = selectedContainers.includes("Sous-produits");
        } else if (GROUPS.CUVES.includes(container.type)) {
          matchContainer = selectedContainers.includes("Cuves");
        } else if (GROUPS.BOIS.includes(container.type)) {
          matchContainer = selectedContainers.includes("Bois");
        } else if (container.type === "CITERNE" || container.type === "COMPARTIMENT") {
          matchContainer = selectedContainers.includes("Citernes");
        } else {
          matchContainer = selectedContainers.includes("Autre");
        }
      }
    }

    return matchSearch && matchMillesime && matchCepage && matchLieu && matchStatus && matchContainer;
  });

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>Lots</h1>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setTab("actifs")} style={{ background: tab === "actifs" ? T.accent : "transparent", color: tab === "actifs" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition: "all .2s" }}>
          LOTS ACTIFS ({actifsCount})
        </button>
        <button onClick={() => setTab("historique")} style={{ background: tab === "historique" ? T.accent : "transparent", color: tab === "historique" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition: "all .2s" }}>
          HISTORIQUE ({historiqueCount})
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Recherche code..." style={{ width: 180 }} />

        <MultiSelectDrop label="Tous millésimes" options={uniqueMillesimes} selected={selectedMillesimes} onChange={(next: any[]) => setFilterMillesimes(next as any)} width={150} />
        <MultiSelectDrop label="Tous cépages" options={CEPAGES} selected={selectedCepages} onChange={(next: any[]) => setFilterCepages(next as any)} width={130} />
        <MultiSelectDrop label="Tous lieux-dits" options={uniqueLieux} selected={selectedLieux} onChange={(next: any[]) => setFilterLieux(next as any)} width={150} />
        <MultiSelectDrop label="Tous contenants" options={containerCategories} selected={selectedContainers} onChange={(next: any[]) => setFilterContainers(next as any)} width={180} />
        <MultiSelectDrop label="Tous statuts" options={uniqueStatuses} selected={selectedStatuses} onChange={(next: any[]) => setFilterStatuses(next as any)} format={formatStatus} width={160} />

        {(search || filterMillesimes.length > 0 || filterCepages.length > 0 || filterLieux.length > 0 || filterContainers.length > 0 || filterStatuses.length > 0) && (
          <Btn variant="ghost" onClick={() => { setSearch(""); setFilterMillesimes([]); setFilterCepages([]); setFilterLieux([]); setFilterContainers([]); setFilterStatuses([]); }}>
            Effacer filtres
          </Btn>
        )}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 90px 110px 1fr 130px", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
          <div>Code Lot</div><div>Mill.</div><div>Cép.</div><div>Volume</div><div>Contenant</div><div>Lieu / Zone</div><div>Statut</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: T.textDim }}>Aucun lot dans cette section.</div>
        )}

        {filtered.map((l: any, i: number) => {
          const isDeadBulk = l._type === "bulk" && (l.volume <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(l.status));
          const container = (l._type === "bulk" && !isDeadBulk) ? (state.containers || []).find((c: any) => c.id === l.containerId) : null;

          return (
            <div key={l.code} onClick={() => onSelectLot(l)} style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 90px 110px 1fr 130px", padding: "14px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer", alignItems: "center", opacity: tab === "historique" ? 0.6 : 1 }} onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = T.surfaceHigh} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 600 }}>{l.code}</div>
              <div style={{ fontSize: 13, color: T.text }}>{l.millesime}</div>
              <div style={{ fontSize: 12, color: T.accentLight, fontFamily: "monospace" }}>{l.cepage}</div>
              <div style={{ fontSize: 13, color: T.text }}>
                {l._type === "bottle" ? `${l.volume} btl` : (l.volume > 0 ? formatVolShort(l.volume) : "0 hL")}
              </div>
              <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace" }}>
                {l._type === "bottle" ? l.format : (container ? (container.displayName || container.name) : (isDeadBulk ? "--" : "Vrac"))}
              </div>
              <div style={{ fontSize: 12, color: T.textDim }}>{l.lieu || "--"}</div>
              <Badge label={formatStatus(l.status)} color={LOT_STATUS_COLORS[l.status] || T.textDim} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
