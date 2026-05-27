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

  // Plus de deliveredIds local : la confirmation est portée par le serveur.
  const [confirmDeliveryTarget, setConfirmDeliveryTarget] = useState<any | null>(null);
  const [isValidatingDelivery, setIsValidatingDelivery] = useState(false);
  const [modalDistillerie, setModalDistillerie] = useState(false);
  const [modalBouteilles, setModalBouteilles] = useState(false);
  const [modalVrac, setModalVrac] = useState(false);
  const [selectedBottleShipmentLot, setSelectedBottleShipmentLot] = useState<any | null>(null);

  // --- LOGIQUE MÉTIER ---
  const bottleRows = (state.bottleLots || [])
    .flatMap((lot: any) => (lot.bottleEvents || [])
      .filter((event: any) => event.type === "EXPEDITION" && event.roleInEvent === "SOURCE" && !event.cancelledAt)
      .map((event: any) => {
        const metadata = event.metadata || {};
        const destination = typeof metadata.destination === "string" && metadata.destination.trim()
          ? metadata.destination.trim()
          : null;
        const customer = typeof metadata.customer === "string" && metadata.customer.trim()
          ? metadata.customer.trim()
          : "";

        return {
          id: event.id,
          deliveryType: "BOTTLE",
          eventDatetime: event.eventDatetime,
          date: event.eventDatetime ? new Date(event.eventDatetime).toLocaleDateString("fr-FR") : "--",
          lot,
          quantity: Number(metadata.quantity || event.bottleCount || 0),
          details: [
            customer ? `Client : ${customer}` : null,
            destination ? `Destination : ${destination}` : null,
          ].filter(Boolean).join(" • ") || event.comment || "Client non renseigné",
          operator: event.operator || "--",
          status: metadata.deliveryStatus === "LIVRE" ? "LIVRE" : "EN_LIVRAISON",
        };
      }))
    .sort((a: any,b: any) => new Date(b.eventDatetime || 0).getTime() - new Date(a.eventDatetime || 0).getTime());

  const expeditionsDistillerie = (state.events || [])
    .filter((e: any) => e.type === "DISTILLERIE" || (e.type === "PERTE" && e.note?.includes("[DISTILLERIE]")))
    .sort((a: any,b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const bottleShipmentLots = (state.bottleLots || [])
    .filter((b: any) => getExpeditionEligibility(b).eligible && !b.archivedAt && !b.cancelledAt)
    .sort((a: any, b: any) => String(a.businessCode || a.code || "").localeCompare(String(b.businessCode || b.code || "")));

  const vracShipmentAllowedStatuses = new Set(["VIN_DE_BASE", "ASSEMBLAGE", "ASSEMBLE", "RESERVE"]);
  const lotById = new Map<string, any>((state.lots || []).map((lot: any) => [String(lot.id), lot]));
  const containerById = new Map<string, any>((state.containers || []).map((container: any) => [String(container.id), container]));
  const normalizeVracShipment = (event: any) => {
    const metadata = event.metadata || {};
    const rawLines = Array.isArray(metadata.lines) && metadata.lines.length > 0
      ? metadata.lines
      : [{
          lotId: metadata.lotId || event.lotId || event.lotIds?.[0],
          lotCode: metadata.lotCode,
          volumeHl: metadata.volumeHl || event.volumeOut || 0,
          compartmentLabel: metadata.compartmentLabel || null,
          mode: metadata.mode || "VRAC",
          note: metadata.note || null,
          legacyContainerId: metadata.containerId || event.containerId || event.containerIds?.[0],
        }];
    const lines = rawLines.map((line: any, index: number) => {
      const lot = lotById.get(String(line.lotId));
      const legacyContainerId = line.legacyContainerId || metadata.containerId || event.containerId || event.containerIds?.[0];
      const legacyContainer = legacyContainerId ? containerById.get(String(legacyContainerId)) : null;
      return {
        ...line,
        key: `${event.id}-${line.lotId || index}-${index}`,
        lot,
        lotId: line.lotId,
        lotCode: line.lotCode || lot?.businessCode || lot?.code || `Lot ${line.lotId || "?"}`,
        volumeHl: Number(line.volumeHl || 0),
        compartmentLabel: line.compartmentLabel || (metadata.lines ? "" : "ancien format"),
        mode: line.mode || metadata.mode || "VRAC",
        note: line.note || "",
        legacyContainer,
      };
    });
    const status = metadata.status === "LIVREE" || metadata.deliveryStatus === "LIVRE" ? "LIVREE" : (metadata.status || "PREPAREE");
    const totalVolume = Number(metadata.totalVolumeHl || lines.reduce((sum: number, line: any) => sum + Number(line.volumeHl || 0), 0));
    const client = metadata.client || "Client non renseigné";
    const destination = metadata.destination || "";
    const transporter = metadata.transporter || "";
    const reference = [metadata.truckPlate, metadata.transportReference].filter(Boolean).join(" / ");

    return {
      id: event.id,
      type: "VRAC",
      eventDatetime: event.eventDatetime,
      date: event.date ? event.date.split(" à ")[0] : (event.eventDatetime ? new Date(event.eventDatetime).toLocaleDateString("fr-FR") : "--"),
      client,
      destination,
      transporter,
      reference,
      status,
      isDelivered: status === "LIVREE",
      totalVolume,
      lineCount: Number(metadata.lineCount || lines.length),
      operator: event.operator || "--",
      logisticsNote: metadata.logisticsNote || metadata.note || "",
      legacy: !Array.isArray(metadata.lines),
      lines,
    };
  };
  const vracRows = (state.events || [])
    .filter((event: any) => event.type === "EXPEDITION_VRAC")
    .map(normalizeVracShipment)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.eventDatetime || 0).getTime();
      const dateB = new Date(b.eventDatetime || 0).getTime();
      return dateB - dateA;
    });
  const eligibleVracLots = (state.lots || []).filter((lot: any) => {
    const status = String(lot.status || "");
    return (lot.currentVolume || lot.volume || 0) > 0 && vracShipmentAllowedStatuses.has(status);
  }).sort((a: any, b: any) => String(a.businessCode || a.code || "").localeCompare(String(b.businessCode || b.code || "")));

  // --- ACTION SÉCURISÉE ---
  const executeDelivery = async () => {
    if (!confirmDeliveryTarget || isValidatingDelivery) return;
    setIsValidatingDelivery(true);

    try {
      const payload = {
        type: confirmDeliveryTarget.type,
        id: Number(confirmDeliveryTarget.id),
      };
      const res = await fetch('/api/expeditions/confirm-delivery', {
        method: 'POST',
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(extractApiErrorMessage(data, "Erreur lors de la confirmation de livraison."));
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Livraison confirmée.", color: T.green } });

      if (refreshData) await refreshData();

    } catch(e: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e?.message || "Erreur lors de la confirmation de livraison.", color: T.red } });
    } finally {
      setIsValidatingDelivery(false);
      setConfirmDeliveryTarget(null);
    }
  };

  const gridCols = tab === "vrac" ? "120px 1fr 1fr 1fr 1fr 110px 90px 120px" : "140px 160px 120px 1fr 120px 140px";

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
    const [client, setClient] = useState("");
    const [destination, setDestination] = useState("");
    const [transporter, setTransporter] = useState("");
    const [truckPlate, setTruckPlate] = useState("");
    const [transportReference, setTransportReference] = useState("");
    const [plannedAt, setPlannedAt] = useState("");
    const [logisticsNote, setLogisticsNote] = useState("");
    const [lines, setLines] = useState([{ lotId: "", volume: "", compartmentLabel: "Compartiment 1", mode: "VRAC", note: "" }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
    const getLineLot = (line: any) => eligibleVracLots.find((lot: any) => String(lot.id) === String(line.lotId));
    const getLineVolume = (line: any) => parseFloat(String(line.volume).replace(",", "."));
    const updateLine = (index: number, patch: any) => {
      setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
      setSubmitError("");
    };
    const addLine = () => {
      setLines((current) => [...current, { lotId: "", volume: "", compartmentLabel: `Compartiment ${current.length + 1}`, mode: "VRAC", note: "" }]);
      setSubmitError("");
    };
    const removeLine = (index: number) => {
      setLines((current) => current.length <= 1 ? current : current.filter((_, i) => i !== index));
      setSubmitError("");
    };
    const lineErrors = lines.map((line: any) => {
      const lot = getLineLot(line);
      const volumeNum = getLineVolume(line);
      const maxVolume = lot ? Number(lot.currentVolume || lot.volume || 0) : 0;
      if (!line.lotId) return "Lot obligatoire.";
      if (!lot) return "Lot non éligible.";
      if (!Number.isFinite(volumeNum) || volumeNum <= 0) return "Volume invalide.";
      if (volumeNum > maxVolume) return `Max ${formatVolShort(maxVolume)}.`;
      if (!["VRAC", "CITERNE", "AUTRE"].includes(String(line.mode))) return "Mode invalide.";
      return "";
    });
    const totalVolume = lines.reduce((sum: number, line: any) => {
      const volumeNum = getLineVolume(line);
      return sum + (Number.isFinite(volumeNum) && volumeNum > 0 ? volumeNum : 0);
    }, 0);
    const formValid = client.trim().length > 0 && lines.length > 0 && lineErrors.every((error: string) => !error);

    const submit = async () => {
      if (!formValid || isSubmitting) return;
      setIsSubmitting(true);
      setSubmitError("");

      try {
        const res = await fetch('/api/expeditions/vrac', {
          method: 'POST',
          headers: buildApiHeaders(user),
          body: JSON.stringify({
            client: client.trim(),
            destination: destination.trim() || null,
            transporter: transporter.trim() || null,
            truckPlate: truckPlate.trim() || null,
            transportReference: transportReference.trim() || null,
            plannedAt: plannedAt || null,
            logisticsNote: logisticsNote.trim() || null,
            lines: lines.map((line: any) => ({
              lotId: Number(line.lotId),
              volumeHl: getLineVolume(line),
              compartmentLabel: line.compartmentLabel.trim() || null,
              mode: String(line.mode).toUpperCase(),
              note: line.note.trim() || null,
            })),
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Client">
            <Input value={client} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setClient(e.target.value); setSubmitError(""); }} placeholder="MUMM" disabled={isSubmitting} />
          </FF>
          <FF label="Destination">
            <Input value={destination} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDestination(e.target.value); setSubmitError(""); }} placeholder="REIMS" disabled={isSubmitting} />
          </FF>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Transporteur">
            <Input value={transporter} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTransporter(e.target.value); setSubmitError(""); }} placeholder="Transport Durand" disabled={isSubmitting} />
          </FF>
          <FF label="Immatriculation / citerne">
            <Input value={truckPlate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTruckPlate(e.target.value); setSubmitError(""); }} placeholder="AB-123-CD" disabled={isSubmitting} />
          </FF>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Référence transport">
            <Input value={transportReference} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTransportReference(e.target.value); setSubmitError(""); }} placeholder="BL-2026-001" disabled={isSubmitting} />
          </FF>
          <FF label="Date prévue d'enlèvement">
            <Input type="date" value={plannedAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPlannedAt(e.target.value); setSubmitError(""); }} disabled={isSubmitting} />
          </FF>
        </div>

        <FF label="Note logistique">
          <Input value={logisticsNote} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogisticsNote(e.target.value)} placeholder="Consignes, documents, remarques..." disabled={isSubmitting} />
        </FF>

        <div style={{ marginTop: 18, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>Lots chargés · {formatVolShort(totalVolume)}</div>
          <Btn variant="secondary" onClick={addLine} disabled={isSubmitting}>+ Ajouter ligne</Btn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
          {lines.map((line: any, index: number) => {
            const selectedLot = getLineLot(line);
            const maxVolume = selectedLot ? Number(selectedLot.currentVolume || selectedLot.volume || 0) : 0;
            const error = lineErrors[index];
            return (
              <div key={index} style={{ background: T.surfaceHigh, border: `1px solid ${error && line.lotId ? T.red : T.border}`, borderRadius: 4, padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 100px 120px 1fr 36px", gap: 8, alignItems: "end" }}>
                  <FF label="Lot">
                    <Select value={line.lotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLine(index, { lotId: e.target.value, volume: "" })} disabled={eligibleVracLots.length === 0 || isSubmitting}>
                      <option value="">Sélectionner</option>
                      {eligibleVracLots.map((lot: any) => (
                        <option key={lot.id} value={lot.id}>
                          {(lot.businessCode || lot.code)} · {formatVolShort(lot.currentVolume || lot.volume || 0)}
                        </option>
                      ))}
                    </Select>
                  </FF>
                  <FF label="Volume hL">
                    <Input type="number" step="0.01" value={line.volume} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(index, { volume: e.target.value })} placeholder="0.00" disabled={isSubmitting} style={{ color: error && line.volume ? T.red : T.text }} />
                  </FF>
                  <FF label="Mode">
                    <Select value={line.mode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLine(index, { mode: e.target.value })} disabled={isSubmitting}>
                      <option value="VRAC">Vrac</option>
                      <option value="CITERNE">Citerne</option>
                      <option value="AUTRE">Autre</option>
                    </Select>
                  </FF>
                  <FF label="Compartiment">
                    <Input value={line.compartmentLabel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(index, { compartmentLabel: e.target.value })} placeholder={`Compartiment ${index + 1}`} disabled={isSubmitting} />
                  </FF>
                  <Btn variant="secondary" onClick={() => removeLine(index)} disabled={isSubmitting || lines.length <= 1} style={{ padding: "7px 9px" }}>×</Btn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginTop: 8 }}>
                  <Input value={line.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(index, { note: e.target.value })} placeholder="Note ligne optionnelle" disabled={isSubmitting} />
                  <div style={{ fontSize: 11, color: error ? T.red : T.textDim, minWidth: 110, textAlign: "right" }}>
                    {selectedLot ? `Dispo ${formatVolShort(maxVolume)}` : error}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
            BOUTEILLES ({bottleRows.length})
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
          {tab === "vrac" ? (
            <>
              <div>Date</div><div>Client</div><div>Destination</div><div>Transporteur</div><div>Immat. / Réf.</div><div>Volume</div><div>Lots</div><div>Statut</div>
            </>
          ) : (
            <>
              <div>Date d'expédition</div><div>Lot Source</div><div>Volume - Qtité</div><div>Détails de l'envoi</div><div>Opérateur</div><div>Statut</div>
            </>
          )}
        </div>

        {/* ... L'affichage des vues Bouteilles, Vrac et Distillerie reste identique visuellement ... */}
        {tab === "bouteilles" && (
          <>
            {bottleRows.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune expédition de bouteilles enregistrée.</div>
            ) : bottleRows.map((row: any, i: any) => {
              const isDelivered = row.status === "LIVRE";
              const lotObj = row.lot;

              return (
                <div key={row.id} style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px", alignItems:"center", borderBottom: i<bottleRows.length-1 ? `1px solid ${T.border}` : "none", textAlign: "center" }}>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{row.date}</div>
                  <div onClick={() => lotObj && onSelectLot && onSelectLot(lotObj)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor: lotObj ? "pointer" : "default", textDecoration: lotObj ? "underline" : "none" }}>
                    {lotObj ? (lotObj.businessCode || lotObj.code) : "--"}
                  </div>
                  <div style={{ fontSize:13, color:T.textStrong }}>{row.quantity ? `${row.quantity} btl` : "--"}</div>
                  <div style={{ fontSize:13, color:T.text }}>📦 {row.details}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{row.operator}</div>
                  <div onClick={() => setConfirmDeliveryTarget({ type: "BOTTLE", id: row.id, label: lotObj?.businessCode || lotObj?.code })} style={{cursor:"pointer", transition:"transform 0.1s", opacity: isDelivered ? 0.5 : 1, display: "flex", justifyContent: "center"}}>
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
            ) : vracRows.map((shipment: any, i: any) => {
              return (
                <div key={shipment.id} style={{ borderBottom: i<vracRows.length-1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px 10px", alignItems:"center", textAlign: "center" }}>
                    <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{shipment.date}</div>
                    <div style={{ fontSize:13, color:T.textStrong, fontWeight:700 }}>{shipment.client}</div>
                    <div style={{ fontSize:13, color:T.text }}>{shipment.destination || "--"}</div>
                    <div style={{ fontSize:12, color:T.text }}>{shipment.transporter || "--"}</div>
                    <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{shipment.reference || "--"}</div>
                    <div style={{ fontSize:13, color:T.textStrong }}>{formatVolShort(shipment.totalVolume)}</div>
                    <div style={{ fontSize:13, color:T.text }}>{shipment.lineCount}</div>
                    <div
                      onClick={() => !shipment.isDelivered && setConfirmDeliveryTarget({ type: "VRAC", id: shipment.id, label: shipment.client })}
                      style={{ cursor: shipment.isDelivered ? "default" : "pointer", display: "flex", justifyContent: "center" }}
                    >
                      <Badge label={shipment.isDelivered ? "Livrée" : formatStatus(shipment.status)} color={shipment.isDelivered ? T.textDim : T.accent} />
                    </div>
                  </div>
                  <div style={{ padding:"0 16px 14px 16px" }}>
                    <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
                      {shipment.lines.map((line: any, lineIndex: number) => (
                        <div key={line.key} style={{ display:"grid", gridTemplateColumns:"1.2fr 90px 1fr 90px 1.4fr", gap:10, alignItems:"center", padding:"9px 12px", borderTop: lineIndex === 0 ? "none" : `1px solid ${T.border}`, fontSize:12 }}>
                          <div onClick={() => line.lot && onSelectLot && onSelectLot(line.lot)} style={{ color:T.accent, fontFamily:"monospace", fontWeight:700, cursor: line.lot ? "pointer" : "default", textDecoration: line.lot ? "underline" : "none" }}>
                            {line.lotCode}
                          </div>
                          <div style={{ color:T.textStrong }}>{formatVolShort(line.volumeHl)}</div>
                          <div style={{ color:T.textDim }}>{line.compartmentLabel || "--"}</div>
                          <div><Badge label={line.mode} color={T.textDim} /></div>
                          <div style={{ color:T.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={line.note || line.legacyContainer?.displayName || ""}>
                            {line.note || (line.legacyContainer ? `Ancien format · ${line.legacyContainer.displayName || line.legacyContainer.code}` : (shipment.legacy ? "Ancien format" : "--"))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(shipment.logisticsNote || shipment.operator) && (
                      <div style={{ marginTop:8, fontSize:11, color:T.textDim }}>
                        {shipment.operator ? `Opérateur : ${shipment.operator}` : null}
                        {shipment.operator && shipment.logisticsNote ? " · " : ""}
                        {shipment.logisticsNote || ""}
                      </div>
                    )}
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
                  <div onClick={() => setConfirmDeliveryTarget({ type: "DISTILLERIE", id: e.id, label: lotObj?.businessCode || lotObj?.code || e.lotId })} style={{cursor:"pointer", transition:"transform 0.1s", opacity: isDelivered ? 0.5 : 1, display: "flex", justifyContent: "center"}}>
                    <Badge label={isDelivered ? "Livré ✅" : "En livraison 🚚"} color={isDelivered ? T.textDim : T.accent} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {confirmDeliveryTarget && (
        <Modal title="Confirmation de livraison" onClose={() => setConfirmDeliveryTarget(null)}>
          <div style={{ padding:"20px 0", color:T.text, lineHeight:1.5 }}>
            Confirmez-vous que cette expédition est bien arrivée chez le client ?<br/><br/>
            La livraison sera marquée comme confirmée en base de données.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setConfirmDeliveryTarget(null)} disabled={isValidatingDelivery}>Annuler</Btn>
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
