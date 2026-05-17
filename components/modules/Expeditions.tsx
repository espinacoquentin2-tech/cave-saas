"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, FF, Input, Modal, Select } from "@/components/ui";
import { ExpedierModal } from "@/components/modules/StockBouteilles";
import {
  formatVolShort,
  useAuth,
  useStore,
  useTheme,
} from "@/lib/store";
import {
  buildApiHeaders,
  extractApiErrorMessage,
} from "@/lib/client-app-helpers";
import {
  getBottleLotCount,
  getBottleStatusLabel,
  getExpeditionEligibility,
  normalizeBottleLotStatus,
} from "@/lib/bottles";

const formatStatus = (s: string | null | undefined) => {
  if (!s) return "";
  if (s === "FERMENTATION_ALCOOLIQUE") return "FA";
  if (s === "FERMENTATION_MALOLACTIQUE") return "FML";
  if (s === "FA_ET_FML") return "FA & FML";
  return s.replace(/_/g, " ");
};

// =============================================================================
// EXPÉDITIONS & DISTILLERIE (100% BACKEND AUTHORITY)
// =============================================================================
export function Expeditions({ onSelectLot }: { onSelectLot: any }) {
  const T = useTheme();
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();

  const [tab, setTab] = useState("bouteilles");

  // Plus de deliveredIds local !
  // On utilise l'état du serveur via confirmDeliveryId
  const [confirmDeliveryId, setConfirmDeliveryId] = useState(null);
  const [isValidatingDelivery, setIsValidatingDelivery] = useState(false);
  const [modalDistillerie, setModalDistillerie] = useState(false);
  const [modalBouteilles, setModalBouteilles] = useState(false);
  const [modalVrac, setModalVrac] = useState(false);
  const [selectedBottleShipmentLot, setSelectedBottleShipmentLot] = useState<any | null>(null);

  // --- LOGIQUE MÉTIER ---
  // On filtre les expéditions depuis les événements du store (chargés via fetchAll)
  const expeditionsBouteilles = (state.events || [])
    .filter((e: any) => e.type === "EXPEDITION")
    .sort((a: any,b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expeditionsDistillerie = (state.events || [])
    .filter((e: any) => e.type === "DISTILLERIE" || (e.type === "PERTE" && e.note?.includes("[DISTILLERIE]")))
    .sort((a: any,b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const bottleShipmentLots = (state.bottleLots || [])
    .filter((b: any) => getExpeditionEligibility(b).eligible && !b.archivedAt && !b.cancelledAt)
    .sort((a: any, b: any) => String(a.businessCode || a.code || "").localeCompare(String(b.businessCode || b.code || "")));

  const isVracShipmentContainer = (container: any) => ["CITERNE", "COMPARTIMENT"].includes(container?.type);
  const vracShipmentAllowedStatuses = new Set(["VIN_DE_BASE", "ASSEMBLAGE", "ASSEMBLE", "RESERVE"]);
  const findLotContainer = (lot: any) => {
    const lotContainerId = lot.currentContainerId || lot.containerId || lot.currentContainer?.id;
    return (state.containers || []).find((c: any) => String(c.id) === String(lotContainerId)) || lot.currentContainer || null;
  };
  const findVracShipmentEvent = (lot: any, container: any) => (state.events || []).find((event: any) => {
    if (event.type !== "EXPEDITION_VRAC" && !(event.type === "EXPEDITION" && String(event.note || event.comment || "").toLowerCase().includes("expedition vrac"))) return false;
    const eventLotIds = event.lotIds || (event.lotId ? [event.lotId] : []);
    const eventContainerIds = event.containerIds || (event.containerId ? [event.containerId] : []);
    return eventLotIds.some((id: any) => String(id) === String(lot.id))
      || (container && eventContainerIds.some((id: any) => String(id) === String(container.id)));
  });
  const vracRows = (state.lots || [])
    .map((lot: any) => {
      const container = findLotContainer(lot);
      return { lot, container, shipmentEvent: findVracShipmentEvent(lot, container) };
    })
    .filter(({ container }: any) => isVracShipmentContainer(container))
    .sort((a: any, b: any) => {
      const dateA = new Date(a.shipmentEvent?.eventDatetime || a.lot.createdAt || a.lot.date || 0).getTime();
      const dateB = new Date(b.shipmentEvent?.eventDatetime || b.lot.createdAt || b.lot.date || 0).getTime();
      return dateB - dateA;
    });
  const eligibleVracRows = vracRows.filter(({ lot }: any) => {
    const status = String(lot.status || "");
    return (lot.currentVolume || lot.volume || 0) > 0 && vracShipmentAllowedStatuses.has(status);
  });

  // --- ACTION SÉCURISÉE ---
  const executeDelivery = async () => {
    if (!confirmDeliveryId) return;
    setIsValidatingDelivery(true);

    try {
      // On met à jour le statut DIRECTEMENT en base de données
      const res = await fetch('/api/containers', {
        method: 'PUT',
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          id: parseInt(confirmDeliveryId),
          status: 'LIVRE' // Le backend devient le seul juge du statut
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur serveur");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Expédition archivée et marquée comme livrée.", color: T.green } });

      // On rafraîchit les données pour que tous les utilisateurs voient le changement
      if (refreshData) await refreshData();

    } catch(e: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e?.message || "Erreur serveur", color: T.red } });
    } finally {
      setIsValidatingDelivery(false);
      setConfirmDeliveryId(null);
    }
  };

  const parseBottleNote = (note: any) => {
    const match = note?.match(/(\d+)\s*btl/);
    const qty = match ? match[0] : "--";
    let details = note || "";
    if (details.includes("- Client :")) {
       details = "Client : " + details.split("- Client :")[1].trim();
    } else {
       details = details.replace(/Expédition de \d+ btl.*\.?/i, "").trim();
       if (!details) details = "Destinataire non renseigné";
    }
    return { qty, details };
  };

  const gridCols = "140px 160px 120px 1fr 120px 140px";

  const BottleShipmentSelectModal = () => (
    <Modal title="Nouvel envoi bouteilles" onClose={() => setModalBouteilles(false)}>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, maxHeight: 360, overflowY: "auto", background: T.surfaceHigh }}>
        {bottleShipmentLots.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: T.textDim, fontSize: 13 }}>
            Aucun lot bouteille prêt à l'expédition.
          </div>
        ) : bottleShipmentLots.map((bl: any, i: number) => {
          const stock = getBottleLotCount(bl);
          const status = normalizeBottleLotStatus(bl.status, bl.type);
          const location = [bl.zone || bl.locationZone, bl.palette || bl.locationPalette, bl.rack || bl.locationRack].filter(Boolean).join(" / ") || "--";

          return (
            <div
              key={bl.id}
              onClick={() => { setSelectedBottleShipmentLot(bl); setModalBouteilles(false); }}
              style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 90px 120px 1fr", gap: 12, padding: "12px 14px", borderBottom: i < bottleShipmentLots.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center", cursor: "pointer" }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = T.accent + "12"; }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 700 }}>{bl.businessCode || bl.code}</div>
              <div style={{ fontSize: 12, color: T.text }}>{bl.format || bl.formatCode || "--"}</div>
              <div style={{ fontSize: 13, color: T.textStrong, fontWeight: "bold" }}>{stock} btl</div>
              <div><Badge label={getBottleStatusLabel(status, bl.type)} color={T.green} /></div>
              <div style={{ fontSize: 12, color: T.textDim }}>{location}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <Btn variant="secondary" onClick={() => setModalBouteilles(false)}>Fermer</Btn>
      </div>
    </Modal>
  );

  const VracShipmentModal = () => {
    const [lotId, setLotId] = useState("");
    const [volume, setVolume] = useState("");
    const [client, setClient] = useState("");
    const [destination, setDestination] = useState("");
    const [mode, setMode] = useState("CITERNE");
    const [note, setNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
    const selectedRow = eligibleVracRows.find(({ lot }: any) => String(lot.id) === String(lotId));
    const selectedLot = selectedRow?.lot;
    const selectedContainer = selectedRow?.container;
    const maxVolume = selectedLot ? Number(selectedLot.currentVolume || selectedLot.volume || 0) : 0;
    const volumeNum = parseFloat(String(volume).replace(",", "."));
    const volumeInvalid = !!volume && (!Number.isFinite(volumeNum) || volumeNum <= 0 || volumeNum > maxVolume);
    const formValid = !!selectedLot && !!selectedContainer && Number.isFinite(volumeNum) && volumeNum > 0 && volumeNum <= maxVolume && client.trim().length > 0 && destination.trim().length > 0 && !!mode;

    const submit = async () => {
      if (!formValid || isSubmitting) return;
      setIsSubmitting(true);
      setSubmitError("");

      try {
        const res = await fetch('/api/expeditions/vrac', {
          method: 'POST',
          headers: buildApiHeaders(user),
          body: JSON.stringify({
            lotId: Number(selectedLot.id),
            containerId: Number(selectedContainer.id),
            volumeHl: volumeNum,
            client: client.trim(),
            destination: destination.trim(),
            mode: String(mode).toUpperCase(),
            note: note.trim() || null,
            idempotencyKey,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(extractApiErrorMessage(data, "Erreur lors de l'expédition vrac."));
        }

        dispatch({ type: "TOAST_ADD", payload: { msg: "Expédition vrac enregistrée.", color: T.accent } });
        if (refreshData) await refreshData();
        setModalVrac(false);
      } catch (e: any) {
        setSubmitError(e?.message || "Erreur lors de l'expédition vrac.");
        setIdempotencyKey(crypto.randomUUID());
        setIsSubmitting(false);
      }
    };

    return (
      <Modal title="Nouvel envoi vrac / citerne" onClose={() => setModalVrac(false)}>
        <FF label="Lot vrac éligible">
          <Select value={lotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setLotId(e.target.value); setVolume(""); setSubmitError(""); }} disabled={eligibleVracRows.length === 0 || isSubmitting}>
            <option value="">Sélectionner un lot</option>
            {eligibleVracRows.map(({ lot, container }: any) => (
              <option key={lot.id} value={lot.id}>
                {(lot.businessCode || lot.code)} · {(container.displayName || container.name || container.code)} · {formatVolShort(lot.currentVolume || lot.volume || 0)}
              </option>
            ))}
          </Select>
        </FF>

        {selectedLot && (
          <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Contenant actuel</div>
                <div style={{ fontSize: 13, color: T.textStrong }}>{selectedContainer?.displayName || selectedContainer?.name || selectedContainer?.code || "--"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Type</div>
                <div style={{ fontSize: 13, color: T.textStrong }}>{selectedContainer?.type || "--"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Volume disponible</div>
                <div style={{ fontSize: 13, color: T.textStrong }}>{formatVolShort(maxVolume)}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label={`Volume à expédier${selectedLot ? ` (max ${formatVolShort(maxVolume)})` : ""}`}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input type="number" step="0.1" value={volume} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setVolume(e.target.value); setSubmitError(""); }} placeholder="0.0" disabled={isSubmitting} style={{ flex: 1, color: volumeInvalid ? T.red : T.text }} />
              <Btn variant="secondary" onClick={() => setVolume(maxVolume.toString())} disabled={!selectedLot || isSubmitting}>MAX</Btn>
            </div>
            {volumeInvalid && <div style={{ color: T.red, fontSize: 11, marginTop: 6 }}>Volume invalide ou supérieur au disponible.</div>}
          </FF>
          <FF label="Mode d'envoi">
            <Select value={mode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setMode(e.target.value); setSubmitError(""); }} disabled={isSubmitting}>
              <option value="CITERNE">Citerne</option>
              <option value="VRAC">Vrac</option>
              <option value="AUTRE">Autre</option>
            </Select>
          </FF>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Client">
            <Input value={client} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setClient(e.target.value); setSubmitError(""); }} placeholder="Nom client" disabled={isSubmitting} />
          </FF>
          <FF label="Destination">
            <Input value={destination} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDestination(e.target.value); setSubmitError(""); }} placeholder="Destination" disabled={isSubmitting} />
          </FF>
        </div>

        <FF label="Note optionnelle">
          <Input value={note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)} placeholder="Bon, transporteur, consignes..." disabled={isSubmitting} />
        </FF>

        {submitError && (
          <div style={{ background: T.red + "11", border: `1px solid ${T.red}33`, color: T.red, borderRadius: 4, padding: 12, marginTop: 12, fontSize: 12 }}>
            {submitError}
          </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
          <Btn variant="secondary" onClick={() => setModalVrac(false)} disabled={isSubmitting}>Annuler</Btn>
          <Btn onClick={submit} disabled={!formValid || isSubmitting} style={{ opacity: (!formValid || isSubmitting) ? 0.55 : 1 }}>
            {isSubmitting ? "Enregistrement..." : "Valider l'expédition"}
          </Btn>
        </div>
      </Modal>
    );
  };

  // ==========================================
  // COMPOSANT INTERNE : MODALE DISTILLERIE
  // ==========================================
  const DistillerieModal = () => {
    const [lotId, setLotId] = useState("");
    const [volume, setVolume] = useState("");
    const [motif, setMotif] = useState("Lies");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("TOUS");

    const availLots = (state.lots || []).filter((l: any) => l.currentVolume > 0 && l.status !== "TIRE" && l.status !== "ARCHIVE");
    const selectedLot = availLots.find((l: any) => String(l.id) === String(lotId));

    const filteredLots = availLots.filter((l: any) => {
      if (search && !l.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== "TOUS") {
        if (filterStatus === "LIES" && l.status !== "LIES") return false;
        if (filterStatus === "BOURBES" && l.status !== "BOURBES") return false;
        if (filterStatus === "REBECHES" && l.status !== "REBECHES") return false;
        if (filterStatus === "AUTRES" && ["LIES", "BOURBES", "REBECHES"].includes(l.status)) return false;
      }
      return true;
    });

    const submit = async () => {
      const volNum = parseFloat(volume.replace(',', '.'));
      if (!selectedLot || !volNum || volNum <= 0) return alert("Veuillez saisir un volume valide.");
      if (volNum > selectedLot.currentVolume) return alert("Le volume saisi dépasse le volume disponible du lot.");

      setIsSubmitting(true);

      try {
        // On utilise la route des pertes que nous avions créée précédemment !
        const payload = {
          entityType: "BULK",
          entityId: String(lotId),
          amount: volNum,
          note: `[DISTILLERIE] Motif: ${motif} - ${notes}`.trim(),
          idempotencyKey
        };

        const res = await fetch('/api/pertes', {
          method: 'POST',
          headers: buildApiHeaders(user),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Erreur de sauvegarde.");
        if (!res.ok) throw new Error(data.message || data.error || "Erreur de sauvegarde.");

        // Si on vide la cuve, on la passe en nettoyage (API Cuverie existante)
        if (volNum >= selectedLot.currentVolume && selectedLot.currentContainerId) {
          await fetch('/api/containers', {
            method: 'PUT',
            headers: buildApiHeaders(user),
            body: JSON.stringify({ id: selectedLot.currentContainerId, status: 'NETTOYAGE' })
          }).catch(()=>{});
        }

        dispatch({ type: "TOAST_ADD", payload: { msg: "Envoi en distillerie enregistré et certifié !", color: T.accent } });
        if (refreshData) await refreshData();
        setModalDistillerie(false);

      } catch(e: any) {
        alert(e?.message || "Erreur de sauvegarde.");
        setIsSubmitting(false);
      }
    };

    return (
      <Modal title="Nouvel envoi en Distillerie" onClose={() => setModalDistillerie(false)}>
        <div style={{ background: T.red+"15", padding: 14, borderRadius: 4, marginBottom: 20, fontSize: 12, color: T.red, borderLeft: `3px solid ${T.red}` }}>
          L'opération est définitive. Le volume sera soustrait du lot et tracé dans le registre des douanes.
        </div>

        {!selectedLot ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Sélectionner le lot à expédier</div>

            <div style={{ display: "flex", gap: 8 }}>
              <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Rechercher code..." style={{ flex: 1 }} autoFocus disabled={isSubmitting} />
              <Select value={filterStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)} style={{ width: 140 }} disabled={isSubmitting}>
                <option value="TOUS">Tous types</option>
                <option value="LIES">Lies</option>
                <option value="BOURBES">Bourbes</option>
                <option value="REBECHES">Rebêches</option>
                <option value="AUTRES">Vins / Moûts</option>
              </Select>
            </div>

            <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, maxHeight: 220, overflowY: "auto", background: T.surfaceHigh }}>
              {filteredLots.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: T.textDim, fontSize: 12 }}>Aucun lot trouvé.</div>
              ) : filteredLots.map((l: any) => (
                <div
                  key={l.id} onClick={() => { if(!isSubmitting){ setLotId(l.id); setVolume(l.currentVolume.toString()); } }}
                  style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, cursor: isSubmitting ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { if(!isSubmitting) e.currentTarget.style.background = T.accent+"15" }} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = "transparent"}
                >
                  <div>
                    <div style={{ fontSize: 13, color: T.accent, fontWeight: "bold", fontFamily: "monospace" }}>{l.code}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{l.status}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong }}>{l.currentVolume} hL</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: T.surfaceHigh, border: `1px solid ${T.accent}`, borderRadius: 6, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Lot sélectionné</div>
                <div style={{ fontSize: 16, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace" }}>{selectedLot.code}</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{selectedLot.status} • Disponible : {selectedLot.currentVolume} hL</div>
              </div>
              <Btn variant="secondary" onClick={() => { setLotId(""); setVolume(""); }} disabled={isSubmitting} style={{ fontSize: 10, padding: "4px 8px" }}>Changer</Btn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label={`Volume expédié (Max ${selectedLot.currentVolume} hL)`}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Input type="number" step="0.1" value={volume} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVolume(e.target.value)} disabled={isSubmitting} placeholder="0.0" style={{ flex: 1, fontWeight: "bold", color: parseFloat(volume) > selectedLot.currentVolume ? T.red : T.text }} />
                  <Btn variant="secondary" onClick={() => setVolume(selectedLot.currentVolume.toString())} disabled={isSubmitting}>MAX</Btn>
                </div>
              </FF>
              <FF label="Motif légal">
                <Select value={motif} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMotif(e.target.value)} disabled={isSubmitting}>
                  <option value="Lies">Lies</option>
                  <option value="Bourbes">Bourbes</option>
                  <option value="Rebêches">Rebêches</option>
                  <option value="Vin altéré (Défaut)">Vin altéré (Défaut)</option>
                  <option value="Fonds de cuve">Fonds de cuve</option>
                </Select>
              </FF>
            </div>
          </div>
        )}

        {selectedLot && (
           <div style={{ marginTop: 12 }}>
             <FF label="Détails (Transporteur, n° de bon...)">
               <Input value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} disabled={isSubmitting} placeholder="Ex: Enlèvement par Distillerie X..." />
             </FF>
           </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <Btn variant="secondary" onClick={() => setModalDistillerie(false)} disabled={isSubmitting}>Annuler</Btn>
          <Btn onClick={submit} disabled={isSubmitting || !lotId || !volume || parseFloat(volume) > selectedLot?.currentVolume} style={{ background: isSubmitting ? T.textDim : T.red, borderColor: isSubmitting ? T.textDim : T.red, color: "#fff" }}>
            {isSubmitting ? "Enregistrement..." : "Valider l'expédition"}
          </Btn>
        </div>
      </Modal>
    );
  };

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Expéditions</h1>
      </div>

      <div style={{ display:"flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom:20 }}>
        <div style={{ display:"flex", gap: 10 }}>
          <button onClick={() => setTab("bouteilles")} style={{ background: tab==="bouteilles" ? T.accent : "transparent", color: tab==="bouteilles" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
            BOUTEILLES ({expeditionsBouteilles.length})
          </button>
          <button onClick={() => setTab("vrac")} style={{ background: tab==="vrac" ? T.accent : "transparent", color: tab==="vrac" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
            VRAC / CITERNE ({vracRows.length})
          </button>
          <button onClick={() => setTab("distillerie")} style={{ background: tab==="distillerie" ? T.red : "transparent", color: tab==="distillerie" ? T.bg : T.red, border: `1px solid ${T.red}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
            DISTILLERIE ({expeditionsDistillerie.length})
          </button>
        </div>

        {tab === "bouteilles" && (
          <Btn onClick={() => setModalBouteilles(true)}>
            + Nouvel envoi
          </Btn>
        )}
        {tab === "vrac" && (
          <Btn onClick={() => setModalVrac(true)}>
            + Nouvel envoi
          </Btn>
        )}
        {tab === "distillerie" && (
          <Btn onClick={() => setModalDistillerie(true)} style={{ background: T.red, borderColor: T.red, color: "#fff" }}>
            + Nouvel envoi
          </Btn>
        )}
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>

        <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, textAlign: "center", background: T.surfaceHigh }}>
          <div>Date d'expédition</div><div>Lot Source</div><div>Volume - Qtité</div><div>Détails de l'envoi</div><div>Opérateur</div><div>Statut</div>
        </div>

        {/* ... L'affichage des vues Bouteilles, Vrac et Distillerie reste identique visuellement ... */}
        {tab === "bouteilles" && (
          <>
            {expeditionsBouteilles.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune expédition de bouteilles enregistrée.</div>
            ) : expeditionsBouteilles.map((e: any, i: any) => {
              const { qty, details } = parseBottleNote(e.comment || e.note);
              const isDelivered = e.status === "LIVRE";
              const lotObj = (state.bottleLots || []).find((l: any) => String(l.id) === String(e.lotId || e.bottleLotId));

              return (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px", alignItems:"center", borderBottom: i<expeditionsBouteilles.length-1 ? `1px solid ${T.border}` : "none", textAlign: "center" }}>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{e.date ? e.date.split(" à ")[0] : new Date(e.eventDatetime).toLocaleDateString('fr-FR')}</div>
                  <div onClick={() => lotObj && onSelectLot && onSelectLot(lotObj)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor: lotObj ? "pointer" : "default", textDecoration: lotObj ? "underline" : "none" }}>
                    {lotObj ? lotObj.code : "--"}
                  </div>
                  <div style={{ fontSize:13, color:T.textStrong }}>{qty}</div>
                  <div style={{ fontSize:13, color:T.text }}>📦 {details}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{e.operator}</div>
                  <div onClick={() => setConfirmDeliveryId(e.id)} style={{cursor:"pointer", transition:"transform 0.1s", opacity: isDelivered ? 0.5 : 1, display: "flex", justifyContent: "center"}}>
                    <Badge label={isDelivered ? "Livré ✅" : "En livraison 🚚"} color={isDelivered ? T.textDim : T.accent} />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "vrac" && (
          <>
            {vracRows.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune expédition vrac / citerne à afficher.</div>
            ) : vracRows.map(({ lot, container, shipmentEvent }: any, i: any) => {
              const shipmentDate = shipmentEvent?.date
                ? shipmentEvent.date.split(" à ")[0]
                : lot.createdAt
                ? new Date(lot.createdAt).toLocaleDateString('fr-FR')
                : "--";
              const containerName = container ? (container.displayName || container.name || container.code) : "Citerne";
              const details = [
                shipmentEvent?.note || shipmentEvent?.comment || containerName,
                container?.code && container?.code !== containerName ? container.code : null,
                container?.zone ? `Zone : ${container.zone}` : null,
                !shipmentEvent ? lot.notes || null : null,
              ].filter(Boolean).join(" • ");
              const displayVolume = shipmentEvent?.volumeOut ? shipmentEvent.volumeOut : (lot.currentVolume || lot.volume || 0);
              const statusLabel = formatStatus(container?.status || lot.status || "EN COURS");

              return (
                <div key={lot.id} style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px", alignItems:"center", borderBottom: i<vracRows.length-1 ? `1px solid ${T.border}` : "none", textAlign: "center" }}>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{shipmentDate}</div>
                  <div onClick={() => lot && onSelectLot && onSelectLot(lot)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor: lot ? "pointer" : "default", textDecoration: lot ? "underline" : "none" }}>
                    {lot.businessCode || lot.code || "--"}
                  </div>
                  <div style={{ fontSize:13, color:T.textStrong }}>{formatVolShort(displayVolume)}</div>
                  <div style={{ fontSize:13, color:T.text }}>🚛 {details || "Citerne / compartiment"}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{shipmentEvent?.operator || "--"}</div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Badge label={statusLabel} color={container?.status === "LIVRE" ? T.textDim : T.accent} />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ... Autres vues (Vrac, Distillerie) copiées de votre code original car elles sont justes en UI ... */}
        {tab === "distillerie" && (
          <>
            {expeditionsDistillerie.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucun envoi en distillerie enregistré.</div>
            ) : expeditionsDistillerie.map((e: any, i: any) => {
              const lotObj = (state.lots || []).find((l: any) => String(l.id) === String(e.lotId));
              const noteText = e.comment || e.note || "";
              let cleanNote = noteText.replace(/\[DISTILLERIE\](\s*Motif:\s*)?/i, "");
              cleanNote = cleanNote.replace(/Perte\/Manquant de [\d.,]+\s*hL\.?\s*/i, "").trim();

              const isDelivered = e.status === "LIVRE";
              const fallbackVol = noteText.match(/(\d+(?:[.,]\d+)?)\s*(?:hL|btl)/i)?.[1] || 0;
              const displayVol = e.volumeChange ? Math.abs(e.volumeChange) : (e.volumeOut > 0 ? e.volumeOut : fallbackVol);

              return (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px", alignItems:"center", borderBottom: i<expeditionsDistillerie.length-1 ? `1px solid ${T.border}` : "none", background: T.red+"08", textAlign: "center" }}>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{e.date ? e.date.split(" à ")[0] : new Date(e.eventDatetime).toLocaleDateString('fr-FR')}</div>
                  <div onClick={() => lotObj && onSelectLot && onSelectLot(lotObj)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor: lotObj ? "pointer" : "default", textDecoration: lotObj ? "underline" : "none" }}>
                    {lotObj ? lotObj.code : (e.lotId || "Lot Inconnu")}
                  </div>
                  <div style={{ fontSize:14, color:T.red, fontWeight: "bold", fontFamily: "monospace" }}>{displayVol} hL</div>
                  <div style={{ fontSize:13, color:T.textStrong }}>🏭 {cleanNote}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{e.operator}</div>
                  <div onClick={() => setConfirmDeliveryId(e.id)} style={{cursor:"pointer", transition:"transform 0.1s", opacity: isDelivered ? 0.5 : 1, display: "flex", justifyContent: "center"}}>
                    <Badge label={isDelivered ? "Livré ✅" : "En livraison 🚚"} color={isDelivered ? T.textDim : T.accent} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {confirmDeliveryId && (
        <Modal title="Confirmation de livraison" onClose={() => setConfirmDeliveryId(null)}>
          <div style={{ padding:"20px 0", color:T.text, lineHeight:1.5 }}>
            Confirmez-vous que cette citerne est bien arrivée chez le client ?<br/><br/>
            La cuve passera au statut LIVRÉ en base de données.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setConfirmDeliveryId(null)} disabled={isValidatingDelivery}>Annuler</Btn>
            <Btn onClick={executeDelivery} disabled={isValidatingDelivery} style={{ background: isValidatingDelivery ? T.textDim : T.green, color:T.bg, borderColor: isValidatingDelivery ? T.textDim : T.green }}>
              {isValidatingDelivery ? "Validation..." : "Oui, confirmer la livraison"}
            </Btn>
          </div>
        </Modal>
      )}

      {modalBouteilles && <BottleShipmentSelectModal />}
      {selectedBottleShipmentLot && <ExpedierModal bl={selectedBottleShipmentLot} onClose={() => setSelectedBottleShipmentLot(null)} />}
      {modalVrac && <VracShipmentModal />}
      {modalDistillerie && <DistillerieModal />}
    </div>
  );
}
