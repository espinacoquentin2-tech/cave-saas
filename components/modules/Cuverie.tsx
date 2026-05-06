"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, FillBar, Input, MultiSelectDrop } from "@/components/ui";
import { getTypeColor, useAuth, useStore, useTheme } from "@/lib/store";
import { getCurrentUserRoleKey, roleMatches } from "@/lib/roles";

type ContainerTileProps = {
  c: any;
  onClick: () => void;
};

function ContainerTile({ c, onClick }: ContainerTileProps) {
  const T = useTheme();
  const { state } = useStore();

  // NOUVEAU : On récupère les enfants et on utilise les bons champs BDD
  const enfants = (state.containers || []).filter((enfant: any) => enfant.parentId === c.id);
  const totalCapacity = (c.capacityValue || c.capacity || 0) + enfants.reduce((sum: any, e: any) => sum + (e.capacityValue || e.capacity || 0), 0);
  let totalVolume = (c.currentVolume || 0) + enfants.reduce((sum: any, e: any) => sum + (e.currentVolume || 0), 0);

  const isReallyEmpty = c.status === "VIDE" || c.status === "NETTOYAGE" || totalVolume <= 0;
  totalVolume = isReallyEmpty ? 0 : totalVolume;

  const pct = totalCapacity > 0 ? Math.round((totalVolume / totalCapacity) * 100) : 0;
  const tc = getTypeColor(c.type);

  // Utilisation de currentContainerId pour la correspondance
  const lot = isReallyEmpty ? null : (state.lots || []).find((l: any) => String(l.id) === String(c.lotId) || String(l.currentContainerId || l.containerId) === String(c.id));
  const displayStatus = isReallyEmpty && c.status !== "NETTOYAGE" ? "VIDE" : c.status;

  const formatVolShort = (vol: any) => typeof vol === "number" ? `${vol.toFixed(1)} hL` : `${vol} hL`;

  return (
    <div onClick={onClick} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:16, cursor:"pointer", position:"relative", overflow:"hidden", borderLeft:`3px solid ${displayStatus === "NETTOYAGE" ? T.blue : tc}`, transition: "transform 0.2s, box-shadow 0.2s" }} onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${T.accent}11`; }} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:tc+"0d", pointerEvents:"none" }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:14, fontFamily:"monospace", color:T.textStrong, fontWeight: "bold" }}>{c.displayName || c.name}</div>
          <div style={{ fontSize:10, color:T.textDim }}>{c.type.replace(/_/g," ")} {enfants.length > 0 && `(${enfants.length + 1} Comps)`}</div>
        </div>
        <div style={{ width: 24, height: 32, border:`2px solid ${tc}66`, borderRadius: 2, position:"relative", overflow:"hidden", background: T.surfaceHigh }}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:tc+"88" }} />
        </div>
      </div>
      {lot ? (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:T.accentLight, fontFamily:"monospace", fontWeight: "bold" }}>{lot.businessCode || lot.code} {enfants.length > 0 && "+ autres"}</div>
          {lot.qualiteLot && <div style={{ fontSize:10, color:T.textDim, marginTop:3 }}>Qualité: {lot.qualiteLot}</div>}
        </div>
      ) : (
        <div style={{ fontSize:11, color:T.textDim, marginBottom:10, fontStyle:"italic" }}>Vide</div>
      )}
      <FillBar pct={pct} color={tc} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, alignItems:"center" }}>
        <div style={{ fontSize:13, color:T.textStrong, fontWeight: "bold" }}>
          {totalVolume > 0 ? formatVolShort(totalVolume) : "--"}
          <span style={{ color:T.textDim, fontSize:10, fontWeight: "normal" }}> / {totalCapacity} hL</span>
        </div>
        <Badge label={displayStatus.replace(/_/g," ")} color={displayStatus === "NETTOYAGE" ? T.blue : (displayStatus === "VIDE" ? T.textDim : tc)} />
      </div>
    </div>
  );
}

type CuverieProps = {
  onSelectContainer: (container: any) => void;
  AddContainerModal: React.ComponentType<{ onClose: () => void }>;
};

export function Cuverie({ onSelectContainer, AddContainerModal }: CuverieProps) {
  const T = useTheme();
  const { state } = useStore();
  const { user } = useAuth();
  const currentUserRoleKey = getCurrentUserRoleKey(user);

  const [mainFilter, setMainFilter] = useState("TOUS");
  const [subFilter, setSubFilter] = useState("");
  const [search, setSearch] = useState("");

  const [filterZones, setFilterZones] = useState<string[]>([]);
  const [filterQualites, setFilterQualites] = useState<string[]>([]);
  const [modal, setModal] = useState(false);

  const GROUPS = {
    CUVES: ["CUVE_INOX", "CUVE_BETON", "CUVE_EMAIL", "CUVE_FIBRE", "CUVE_PLASTIQUE"],
    BOIS: ["BARRIQUE", "FOUDRE"],
    SOUS_PRODUITS: ["CUVE_BOURBES", "CUVE_LIES", "CUVE_REBECHES"]
  };

  const uniqueZones = [...new Set((state.containers || []).map((c: any) => c.zone).filter(Boolean))].sort();
  const uniqueQualites = [...new Set((state.lots || []).map((l: any) => (l.qualiteLot || "").trim()).filter(Boolean))].sort();

  const handleMainFilter = (f: string) => {
    setMainFilter(f);
    setSubFilter("");
  };

  const filtered = (state.containers || []).filter((c: any) => {
    if (
      c.status === "LIVRE" ||
      c.status === "ARCHIVÉE" ||
      c.parentId ||
      c.type === "COMPARTIMENT" ||
      c.type === "CUVE_DEBOURBAGE" ||
      c.type?.includes("Débourbage") ||
      c.type?.includes("Belon")
    ) {
      return false;
    }

    const matchSearch = !search || (c.displayName || c.name).toLowerCase().includes(search.toLowerCase());
    const matchZone = filterZones.length === 0 || filterZones.includes(c.zone);
    const lotInContainer = (state.lots || []).find((l: any) =>
      String(l.id) === String(c.lotId) || String(l.currentContainerId || l.containerId) === String(c.id),
    );
    const matchQualite = filterQualites.length === 0 || (lotInContainer?.qualiteLot && filterQualites.includes(lotInContainer.qualiteLot));

    let matchFilter = false;

    const t = (c.type || "").toLowerCase();
    const n = ((c.displayName || c.name) || "").toLowerCase();
    const isSousProduit =
      GROUPS.SOUS_PRODUITS.includes(c.type) ||
      t.includes("bourbe") || t.includes("lies") || t.includes("rebeche") || t.includes("rebêche") ||
      n.includes("bourbe") || n.includes("lies") || n.includes("rebeche") || n.includes("rebêche");

    if (mainFilter === "TOUS") {
      matchFilter = true;
    } else if (mainFilter === "RÉSERVES") {
      matchFilter = (state.lots || []).some((l: any) => (String(l.currentContainerId || l.containerId) === String(c.id) || String(l.id) === String(c.lotId)) && l.status === "RESERVE");
    } else if (mainFilter === "CUVES") {
      if (subFilter) matchFilter = c.type === subFilter && !isSousProduit;
      else matchFilter = GROUPS.CUVES.includes(c.type) && !isSousProduit;
    } else if (mainFilter === "BOIS") {
      if (subFilter) matchFilter = c.type === subFilter;
      else matchFilter = GROUPS.BOIS.includes(c.type);
    } else if (mainFilter === "CITERNE") {
      matchFilter = c.type === "CITERNE";
    } else if (mainFilter === "SOUS-PRODUITS") {
      if (subFilter) matchFilter = isSousProduit && c.type === subFilter;
      else matchFilter = isSousProduit;
    } else if (mainFilter === "AUTRE") {
      matchFilter = c.type === "AUTRE" || (!GROUPS.CUVES.includes(c.type) && !GROUPS.BOIS.includes(c.type) && c.type !== "CITERNE" && !isSousProduit);
    }

    return matchFilter && matchSearch && matchZone && matchQualite;
  });

  const cuvesActives = filtered.filter((c: any) => (parseFloat(c.currentVolume || 0)) > 0);
  const cuvesVides = filtered.filter((c: any) => (parseFloat(c.currentVolume || 0)) <= 0);
  const volumesByQualite = cuvesActives.reduce((acc: Record<string, number>, c: any) => {
    const lotInContainer = (state.lots || []).find((l: any) =>
      String(l.id) === String(c.lotId) || String(l.currentContainerId || l.containerId) === String(c.id),
    );
    const key = lotInContainer?.qualiteLot?.trim() || "Non renseignée";
    acc[key] = (acc[key] || 0) + (parseFloat(c.currentVolume || 0) || 0);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div><h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Cuverie</h1></div>
        {!roleMatches(currentUserRoleKey, ["LECTURE_SEULE"]) && <Btn onClick={() => setModal(true)}>+ Ajouter cuve</Btn>}
      </div>

      <div style={{ display:"flex", gap:10, marginBottom: mainFilter === "CUVES" || mainFilter === "BOIS" || mainFilter === "SOUS-PRODUITS" ? 10 : 20, flexWrap:"wrap" }}>
        <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Rechercher un contenant..." style={{ minWidth:200 }} />

        {uniqueZones.length > 0 && (
          <MultiSelectDrop label="Toutes les zones" options={uniqueZones} selected={filterZones} onChange={setFilterZones} width={160} />
        )}
        {uniqueQualites.length > 0 && (
          <MultiSelectDrop label="Toutes les qualités" options={uniqueQualites} selected={filterQualites} onChange={setFilterQualites} width={180} />
        )}

        {["TOUS", "CUVES", "BOIS", "CITERNE", "RÉSERVES", "SOUS-PRODUITS", "AUTRE"].map(t => (
          <button key={t} onClick={() => handleMainFilter(t)} style={{ background: mainFilter===t ? T.accent+"22" : "none", border:`1px solid ${mainFilter===t ? T.accent : T.border}`, color: mainFilter===t ? T.accent : T.textDim, padding:"7px 16px", borderRadius:4, cursor:"pointer", fontSize:11, fontFamily:"monospace", fontWeight: t === "RÉSERVES" ? "bold" : "normal", transition:"all 0.2s" }}>
            {t}
          </button>
        ))}

        {(search || filterZones.length > 0 || filterQualites.length > 0) && (
          <Btn variant="ghost" onClick={() => { setSearch(""); setFilterZones([]); setFilterQualites([]); }}>Effacer filtres</Btn>
        )}
      </div>
      {Object.keys(volumesByQualite).length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20, background:T.surfaceHigh, padding:10, borderRadius:6, border:`1px solid ${T.border}` }}>
          <span style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>Volumes par qualité :</span>
          {Object.entries(volumesByQualite).sort((a, b) => a[0].localeCompare(b[0])).map(([qualite, volume]) => (
            <Badge key={qualite} label={`${qualite}: ${Number((volume as number).toFixed(2))} hL`} color={T.accentLight} />
          ))}
        </div>
      )}

      {(mainFilter === "CUVES" || mainFilter === "BOIS" || mainFilter === "SOUS-PRODUITS") && (
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", background:T.surfaceHigh, padding:10, borderRadius:6, border:`1px solid ${T.border}` }}>
          <span style={{fontSize:10, color:T.textDim, textTransform:"uppercase", alignSelf:"center", marginRight:10, fontWeight: "bold"}}>Sous-catégories :</span>
          {GROUPS[mainFilter === "SOUS-PRODUITS" ? "SOUS_PRODUITS" : mainFilter].map(t => (
            <button key={t} onClick={() => setSubFilter(subFilter === t ? "" : t)} style={{ background: subFilter===t ? T.accent : "transparent", color: subFilter===t ? T.bg : T.textDim, border:`1px solid ${subFilter===t ? T.accent : T.border}`, padding:"5px 12px", borderRadius:4, cursor:"pointer", fontSize:10, fontFamily:"monospace", transition:"all 0.2s" }}>
              {t.replace("CUVE_", "").replace(/_/g," ")}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:8, color:T.textDim, fontStyle:"italic" }}>Aucun contenant ne correspond à ces critères.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {cuvesActives.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 16px 0", color: T.accentLight, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                Contenants pleins ou en cours d'utilisation ({cuvesActives.length})
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(215px,1fr))", gap:16 }}>
                {cuvesActives.map((c: any) => <ContainerTile key={c.id} c={c} onClick={() => onSelectContainer(c)} />)}
              </div>
            </div>
          )}

          {cuvesVides.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 16px 0", color: T.textDim, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                Contenants vides ou en nettoyage ({cuvesVides.length})
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(215px,1fr))", gap:16 }}>
                {cuvesVides.map((c: any) => (
                  <div key={c.id} style={{ opacity: c.status !== "NETTOYAGE" ? 0.7 : 1, transition: "opacity 0.2s" }}>
                    <ContainerTile c={c} onClick={() => onSelectContainer(c)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modal && <AddContainerModal onClose={() => setModal(false)} />}
    </div>
  );
}
