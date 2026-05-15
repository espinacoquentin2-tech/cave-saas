"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, Input, Modal } from "@/components/ui";
import { LOT_STATUS_COLORS, useStore, useTheme } from "@/lib/store";
import { getBottleStatusLabel } from "@/lib/bottles";
import { buildApiHeaders } from "@/lib/client-app-helpers";
import { BottleEventMetadataDetails } from "@/components/modules/BottleEventMetadataDetails";
import { LotEventMetadataDetails } from "@/components/modules/LotEventMetadataDetails";

export function Tracabilite({ onSelectLot }: { onSelectLot: any }) {
  const T = useTheme(); 
  const { state } = useStore();
  
  const [search, setSearch] = useState("");
  
  // États de l'arbre généalogique chargés depuis le serveur
  const [lineage, setLineage] = useState(null);
  const [isLoadingLineage, setIsLoadingLineage] = useState(false);
  const [maturationModal, setMaturationModal] = useState(null);

  // 1. MOTEUR DE RECHERCHE INITIAL (Sur le store local pour la rapidité de la barre de recherche)
  const allLots = [
    ...(state.lots || []).map((l: any) => ({ ...l, _type: 'bulk' })),
    ...(state.bottleLots || []).map((b: any) => ({ ...b, _type: 'bottle' }))
  ];

  const filteredSearch = allLots
    .filter((l: any) => l.code.toLowerCase().includes(search.toLowerCase()) || (l.lieu && l.lieu.toLowerCase().includes(search.toLowerCase())))
    .slice(0, 12); 

  // 2. FETCH DE L'ARBRE GÉNÉALOGIQUE DEPUIS LE SERVEUR
  const handleFocusLot = async (lotCode: any, type: any) => {
    if (!lotCode) return setLineage(null);
    
    setIsLoadingLineage(true);
    setSearch(""); // On vide la recherche

    try {
      const res = await fetch('/api/tracabilite', {
        method: 'POST',
        headers: buildApiHeaders(undefined),
        body: JSON.stringify({ lotCode, type })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erreur de chargement de la traçabilité.");
      }

      const data = await res.json();
      
      // On remappe `businessCode` vers `code` pour l'affichage UI
      const normalizeNode = (node: any) => ({ ...node, code: node.businessCode || node.code });
      
      setLineage({
        focusedLot: normalizeNode(data.focusedLot),
        parents: data.parents.map(normalizeNode),
        children: data.children.map(normalizeNode),
        expeditions: data.expeditions
      } as any);

    } catch (e: any) {
      alert(e?.message || "Erreur de chargement de la traçabilité.");
      setLineage(null);
    } finally {
      setIsLoadingLineage(false);
    }
  };

  // --- HELPERS UI ---
  const formatStatus = (status: any) => {
    if (!status) return "INCONNU";
    if (status === "FERMENTATION_ALCOOLIQUE") return "FA";
    if (status === "MOUT_NON_DEBOURBE") return "MOÛT BRUT";
    if (status === "MOUT_DEBOURBE") return "JUS CLAIR";
    if (["SUR_LATTES", "A_DEGORGER", "DEGORGE", "PRET_EXPEDITION", "EXPEDIE", "ARCHIVE"].includes(status)) {
      return getBottleStatusLabel(status);
    }
    return status.replace(/_/g, ' ');
  };

  const formatVolShort = (vol: any) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;

  // --- COMPOSANT VISUEL D'UN NOEUD (Carte Lot) ---
  const LotNode = ({ lot, isCenter }: { lot: any; isCenter: any }) => {
    const isBottle = lot._type === 'bottle';
    const volStr = isBottle ? `${lot.currentBottleCount || lot.currentCount || 0} btl` : formatVolShort(lot.currentVolume || lot.volume || 0);
    const badgeColor = isBottle ? T.accentLight : LOT_STATUS_COLORS[lot.status] || T.textDim;
    
    return (
      <div 
        style={{ 
          background: isCenter ? T.surfaceHigh : T.surface, 
          border: `1px solid ${isCenter ? T.accent : T.border}`, 
          borderRadius: 6, padding: "16px", cursor: "pointer", 
          transition: "transform 0.2s, border-color 0.2s",
          boxShadow: isCenter ? `0 4px 20px ${T.accent}22` : "none",
          width: "100%", position: "relative",
          display: "flex", flexDirection: "column", gap: 10,
          opacity: isLoadingLineage ? 0.5 : 1
        }}
        onClick={() => !isCenter && !isLoadingLineage && handleFocusLot(lot.code, lot._type)}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { if(!isLoadingLineage) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = T.accent; } }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = isCenter ? T.accent : T.border; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: "bold", color: isCenter ? T.accent : T.textStrong, fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}>{lot.code}</div>
          <div style={{ flexShrink: 0 }}>
            <Badge label={isBottle ? (lot.format || 'Bouteille') : formatStatus(lot.status)} color={badgeColor} />
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 12, color: T.text }}>Vol: <span style={{ fontWeight: "bold" }}>{volStr}</span></div>
          <div style={{ display: "flex", gap: 6 }}>
            {!isCenter && (
              <Btn variant="secondary" style={{ fontSize: 9, padding: "4px 8px" }} disabled={isLoadingLineage}>📍 Centrer</Btn>
            )}
            <Btn style={{ fontSize: 9, padding: "4px 8px" }} onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onSelectLot(lot); }}>Fiche</Btn>
          </div>
        </div>
      </div>
    );
  };
  const lineageData: any = lineage;

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>Graphe de Traçabilité</h1>
        {lineageData && (
          <Btn variant="secondary" onClick={() => setLineage(null)}>🔄 Nouvelle recherche</Btn>
        )}
      </div>

      {!lineageData ? (
        // ÉCRAN DE RECHERCHE INITIAL
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>🎯</div>
          <h2 style={{ fontSize: 18, color: T.textStrong, marginBottom: 8 }}>Point d'entrée de la cartographie</h2>
          <div style={{ color: T.textDim, fontSize: 13, marginBottom: 24 }}>Recherchez un lot (vrac ou bouteille) pour interroger le serveur sur son ascendance et sa descendance.</div>
          
          <Input 
            value={search} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} 
            placeholder="Rechercher par code lot ou provenance (Ex: 2025-CH)..." 
            style={{ maxWidth: 400, margin: "0 auto 30px", textAlign: "center", fontSize: 16, padding: "12px" }} 
            autoFocus
          />
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16, textAlign: "left" }}>
            {filteredSearch.map((l: any) => (
              <LotNode key={l.id} lot={l} isCenter={false} />
            ))}
          </div>
          {filteredSearch.length === 0 && search && (
            <div style={{ color: T.textDim, fontStyle: "italic", marginTop: 20 }}>Aucun lot trouvé pour "{search}"</div>
          )}
        </div>
      ) : (
        // ÉCRAN CARTOGRAPHIQUE (Généalogie Serveur)
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 30, alignItems: "start", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "30px 20px" }}>
          
          {/* COLONNE GAUCHE : LES PARENTS OU ORIGINES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, textAlign: "center", borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
              ⬅️ Origines (Parents)
            </div>
            
            {lineageData.parents.length > 0 ? (
              lineageData.parents.map((p: any) => (
                <LotNode key={p.id} lot={p} isCenter={false} />
              ))
            ) : lineageData.focusedLot.lieu ? (
              <div style={{ border: `1px dashed ${T.accent}55`, borderRadius: 6, padding: 16, background: T.bg, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>🌱 Origine Raisins (Vendanges)</div>
                {lineageData.focusedLot.lieu.split('+').map((p: any) => p.trim()).map((p: any, i: any) => {
                  const rawName = p.replace(/\s*\([^)]*\)/g, '').trim(); 
                  return (
                    <Btn 
                      key={i} 
                      variant="secondary" 
                      onClick={() => setMaturationModal(rawName)} 
                      style={{ width: "100%", marginBottom: i === lineageData.focusedLot.lieu.split('+').length - 1 ? 0 : 8, fontSize: 11, borderColor: T.accent+"33", color: T.accentLight, padding: "8px" }}
                    >
                      🍇 {p}
                    </Btn>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "30px 20px", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 12 }}>
                Racine d'origine.<br/>Aucun parent identifié en base.
              </div>
            )}
          </div>

          {/* COLONNE CENTRALE : LE LOT CIBLÉ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
            <div style={{ fontSize: 11, color: T.accent, textTransform: "uppercase", letterSpacing: 2, textAlign: "center", borderBottom: `1px solid ${T.accent}44`, paddingBottom: 10, fontWeight: "bold" }}>
              Lot Centré
            </div>
            <div style={{ position: "absolute", left: -30, top: "50%", width: 30, borderTop: `2px dashed ${T.border}`, zIndex: 0 }} />
            <div style={{ position: "absolute", right: -30, top: "50%", width: 30, borderTop: `2px dashed ${T.border}`, zIndex: 0 }} />
            
            <div style={{ position: "relative", zIndex: 1 }}>
              <LotNode lot={lineageData.focusedLot} isCenter={true} />
            </div>
            <div style={{ textAlign: "center", color: T.textDim, fontSize: 11, fontStyle: "italic", padding: "0 10px" }}>
              {lineageData.focusedLot.notes || "Aucune note spécifique."}
            </div>
          </div>

          {/* COLONNE DROITE : LES ENFANTS & EXPÉDITIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, textAlign: "center", borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
              Destinations (Enfants) ➡️
            </div>
            
            {lineageData.children.length === 0 && lineageData.expeditions.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 12 }}>
                Aucune descendance ou expédition enregistrée.
              </div>
            ) : (
              <>
                {lineageData.children.map((c: any) => (
                  <LotNode key={c.id} lot={c} isCenter={false} />
                ))}
                
                {lineageData.expeditions.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: `1px dashed ${T.green}44`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 10, color: T.green, textTransform: "uppercase", letterSpacing: 1, textAlign: "center" }}>Expéditions liées</div>
                    {lineageData.expeditions.map((e: any) => (
                      <div key={e.id} style={{ background: T.green + "11", border: `1px solid ${T.green}55`, borderRadius: 4, padding: "12px" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: "bold", color: T.green }}>📦 {e.comment || "Expédition"}</div>
                          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{new Date(e.eventDatetime).toLocaleDateString('fr-FR')}</div>
                          <BottleEventMetadataDetails metadata={e.metadata} />
                          <LotEventMetadataDetails metadata={e.metadata} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODALE : SUIVI MATURATION --- */}
      {maturationModal && (() => {
        const rawName = maturationModal;
        const matData = (state.maturations || []).filter((m: any) => m.parcelle === rawName).sort((a: any,b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return (
          <Modal title={`📊 Suivi Maturation : ${rawName}`} onClose={() => setMaturationModal(null)} wide>
            {matData.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: T.textDim, fontStyle: "italic", lineHeight: 1.6 }}>
                Aucun relevé de maturation enregistré pour la parcelle <strong>{rawName}</strong> cette année.<br/>
                Les données d'échantillonnage n'ont pas été saisies dans le module Maturation.
              </div>
            ) : (
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>
                      <th style={{ padding: "12px 8px" }}>Date de Prélèvement</th>
                      <th style={{ padding: "12px 8px" }}>Cépage</th>
                      <th style={{ padding: "12px 8px" }}>Sucre (g/L)</th>
                      <th style={{ padding: "12px 8px" }}>Acidité Totale</th>
                      <th style={{ padding: "12px 8px" }}>TAVP Estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matData.map((m: any, i: any) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}55` }}>
                        <td style={{ padding: "12px 8px", color: T.textStrong }}>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: "12px 8px" }}>{m.cepage || '-'}</td>
                        <td style={{ padding: "12px 8px" }}>{m.sucre || '-'}</td>
                        <td style={{ padding: "12px 8px" }}>{m.at || '-'}</td>
                        <td style={{ padding: "12px 8px", color: T.accentLight, fontWeight: "bold" }}>{m.tavp ? `${m.tavp.toFixed(2)} %vol` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <Btn onClick={() => setMaturationModal(null)}>Fermer</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
