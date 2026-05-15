"use client";

import React, { useState } from "react";
import { Badge, Btn, FF, Input, Modal, Select } from "@/components/ui";
import { BOTTLE_STATUS_COLORS, useAuth, useStore, useTheme } from "@/lib/store";
import {
  buildApiHeaders,
} from "@/lib/client-app-helpers";
import {
  getBottleLotCount,
  getBottleStatusLabel,
  getDegorgementEligibility,
  getExpeditionEligibility,
  getHabillageEligibility,
  MIN_SUR_LATTES_MONTHS,
  normalizeBottleLotStatus,
} from "@/lib/bottles";

export function DegorgerModal({ bl, onClose }: { bl: any; onClose: any }) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();
  const { user } = useAuth();

  const [count, setCount] = useState("");
  const [degorgementDate, setDegorgementDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sugar, setSugar] = useState("");
  const [liqueurType, setLiqueurType] = useState("Brut");
  const [liqueurVolumeLiters, setLiqueurVolumeLiters] = useState("");
  const [bouchonProductId, setBouchonProductId] = useState("");
  const [museletProductId, setMuseletProductId] = useState("");
  const [liqueurProductId, setLiqueurProductId] = useState("");
  const [lossCount, setLossCount] = useState("0");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const max = getBottleLotCount(bl);
  const eligibility = getDegorgementEligibility(bl);
  const bouchons = (state.products || []).filter((p: any) => p.subCategory === "Bouchons");
  const muselets = (state.products || []).filter((p: any) => p.subCategory === "Muselets");
  const liqueurs = (state.products || []).filter((p: any) => {
    const subCategory = String(p.subCategory || "").toLowerCase();
    const name = String(p.name || "").toLowerCase();
    return subCategory.includes("liqueur") || name.includes("liqueur");
  });

  const getDosageInfo = (val: string) => {
    if (val === "") return { label: "--", suffix: "", color: T.textDim };
    const g = parseFloat(val);
    if (g === 0) return { label: "Brut Nature / Zéro Dosage", suffix: "-Nature", color: "#8c7355" };
    if (g <= 6) return { label: "Extra-Brut", suffix: "-EBrut", color: "#a68b6a" };
    if (g <= 12) return { label: "Brut", suffix: "-Brut", color: T.accent };
    if (g <= 17) return { label: "Extra-Dry", suffix: "-EDry", color: "#e6c27a" };
    if (g <= 32) return { label: "Sec", suffix: "-Sec", color: "#f0d599" };
    if (g <= 50) return { label: "Demi-Sec", suffix: "-DSec", color: "#fae8b6" };
    return { label: "Doux", suffix: "-Doux", color: "#fff5d1" };
  };

  const dosageInfo = getDosageInfo(sugar);
  const finalDosageString = sugar !== "" ? `${dosageInfo.label} (${sugar} g/L)` : "Non dosé (0 g/L)";

  const submit = async () => {
    const qtyNum = parseInt(count);
    const lossNum = parseInt(lossCount || "0") || 0;
    const sugarNum = parseFloat(sugar);
    if (!qtyNum || qtyNum <= 0 || qtyNum > max) return alert("Quantité invalide.");
    if (lossNum < 0) return alert("Pertes invalides.");
    if (qtyNum + lossNum > max) return alert("Quantité + pertes supérieures au stock disponible.");
    if (Number.isNaN(sugarNum) || sugarNum < 0) return alert("Dosage invalide.");
    if (!degorgementDate) return alert("Date de dégorgement requise.");
    if (!eligibility.eligible) return alert(`Lot non éligible: ${eligibility.reason}`);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bottles/degorger", {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          blId: parseInt(bl.id),
          count: qtyNum,
          degorgementDate,
          dosageGramsPerLiter: sugarNum,
          dosageLabel: dosageInfo.label,
          liqueurType,
          liqueurProductId: liqueurProductId ? parseInt(liqueurProductId) : null,
          liqueurVolumeLiters: liqueurVolumeLiters ? parseFloat(liqueurVolumeLiters) : null,
          bouchonProductId: bouchonProductId ? parseInt(bouchonProductId) : null,
          museletProductId: museletProductId ? parseInt(museletProductId) : null,
          lossCount: lossNum,
          note: note || `Dégorgement ${finalDosageString}`,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || errorData.error || "Erreur de dégorgement");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: `${qtyNum} btl dégorgées${lossNum > 0 ? `, ${lossNum} pertes` : ""} !`, color: T.green } });
      if (refreshData) await refreshData();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Dégorgement" onClose={onClose}>
      <div style={{ background: eligibility.eligible ? T.green + "11" : T.red + "11", border: `1px solid ${eligibility.eligible ? T.green + "33" : T.red + "33"}`, color: eligibility.eligible ? T.textStrong : T.red, borderRadius: 4, padding: 12, marginBottom: 16, fontSize: 12 }}>
        {eligibility.eligible
          ? `Lot éligible au dégorgement: ${eligibility.ageMonths} mois sur lattes.`
          : `Lot bloqué: ${eligibility.reason}${eligibility.reasonCode === "TOO_YOUNG" ? ` (minimum ${MIN_SUR_LATTES_MONTHS} mois)` : ""}.`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FF label={`Nombre de btl (max ${max})`}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input type="number" value={count} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCount(e.target.value)} disabled={isSubmitting} style={{ flex: 1 }} />
            <Btn variant="secondary" onClick={() => setCount(max.toString())} disabled={isSubmitting}>MAX</Btn>
          </div>
        </FF>
        <FF label="Date de dégorgement">
          <Input type="date" value={degorgementDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDegorgementDate(e.target.value)} disabled={isSubmitting} />
        </FF>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FF label="Sucre ajouté (g/L)">
          <Input type="number" step="0.1" placeholder="Ex: 8" value={sugar} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSugar(e.target.value)} disabled={isSubmitting} />
        </FF>
        <FF label="Pertes bouteilles">
          <Input type="number" min="0" value={lossCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLossCount(e.target.value)} disabled={isSubmitting} />
        </FF>
      </div>

      <div style={{ marginTop: 4, marginBottom: 16, textAlign: "right", minHeight: 24 }}>
        {sugar !== "" && <div style={{ fontSize: 11, color: T.textDim }}>Catégorie AOC : <Badge label={dosageInfo.label} color={dosageInfo.color} /></div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <FF label="Type de liqueur">
          <Input value={liqueurType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLiqueurType(e.target.value)} disabled={isSubmitting} placeholder="Ex: Brut" />
        </FF>
        <FF label="Volume liqueur (L)">
          <Input type="number" step="0.1" value={liqueurVolumeLiters} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLiqueurVolumeLiters(e.target.value)} disabled={isSubmitting} placeholder="Optionnel" />
        </FF>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
        <FF label="Bouchon expédition">
          <Select value={bouchonProductId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBouchonProductId(e.target.value)} disabled={isSubmitting}>
            <option value="">-- Aucun --</option>
            {bouchons.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
          </Select>
        </FF>
        <FF label="Muselet">
          <Select value={museletProductId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMuseletProductId(e.target.value)} disabled={isSubmitting}>
            <option value="">-- Aucun --</option>
            {muselets.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
          </Select>
        </FF>
        <FF label="Liqueur stock">
          <Select value={liqueurProductId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLiqueurProductId(e.target.value)} disabled={isSubmitting}>
            <option value="">-- Non gérée en stock --</option>
            {liqueurs.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
          </Select>
        </FF>
      </div>

      <div style={{ marginTop: 8 }}>
        <FF label="Notes">
          <Input value={note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)} disabled={isSubmitting} placeholder="Commentaires opérateur, lot liqueur, anomalies..." />
        </FF>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !count || sugar === "" || !degorgementDate || !eligibility.eligible} style={{ background: isSubmitting ? T.textDim : T.accent }}>
          {isSubmitting ? "Traitement..." : "Valider le dégorgement"}
        </Btn>
      </div>
    </Modal>
  );
}

export function HabillerModal({ bl, onClose }: { bl: any; onClose: any }) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();
  const { user } = useAuth();

  const [count, setCount] = useState("");
  const [habillageDate, setHabillageDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [coiffeId, setCoiffeId] = useState("");
  const [etiquetteId, setEtiquetteId] = useState("");
  const [contreEtiquetteId, setContreEtiquetteId] = useState("");
  const [cartonId, setCartonId] = useState("");
  const [cartonSize, setCartonSize] = useState("6");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const max = getBottleLotCount(bl);
  const eligibility = getHabillageEligibility(bl);
  const coiffes = (state.products || []).filter((p: any) => p.subCategory === "Coiffes");
  const etiquettes = (state.products || []).filter((p: any) => p.subCategory === "Étiquettes");
  const contreEtiquettes = (state.products || []).filter((p: any) => p.subCategory === "Contre-étiquettes");
  const cartons = (state.products || []).filter((p: any) => p.subCategory === "Cartons");

  const submit = async () => {
    const qtyNum = parseInt(count);
    if (!qtyNum || qtyNum <= 0 || qtyNum > max) return alert("Quantité invalide.");
    if (!habillageDate) return alert("Date d'habillage requise.");
    if (!eligibility.eligible) return alert(`Lot non éligible: ${eligibility.reason}`);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bottles/habiller", {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          blId: parseInt(bl.id),
          count: qtyNum,
          habillageDate,
          coiffeId: coiffeId ? parseInt(coiffeId) : null,
          etiquetteId: etiquetteId ? parseInt(etiquetteId) : null,
          contreEtiquetteId: contreEtiquetteId ? parseInt(contreEtiquetteId) : null,
          cartonId: cartonId ? parseInt(cartonId) : null,
          cartonSize: parseInt(cartonSize),
          note,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || errorData.error || "Erreur d'habillage");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: `${qtyNum} btl habillées. Stocks déduits !`, color: "#9960aa" } });
      if (refreshData) await refreshData();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Habillage & Mise en carton" onClose={onClose}>
      <div style={{ background: eligibility.eligible ? T.green + "11" : T.red + "11", border: `1px solid ${eligibility.eligible ? T.green + "33" : T.red + "33"}`, color: eligibility.eligible ? T.textStrong : T.red, borderRadius: 4, padding: 12, marginBottom: 16, fontSize: 12 }}>
        {eligibility.eligible ? "Lot éligible à l'habillage." : `Lot bloqué: ${eligibility.reason}.`}
      </div>
      <FF label={`Nombre de bouteilles à habiller (max ${max})`}>
        <div style={{ display: "flex", gap: 8 }}>
          <Input type="number" value={count} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCount(e.target.value)} disabled={isSubmitting} style={{ flex: 1 }} />
          <Btn variant="secondary" onClick={() => setCount(max.toString())} disabled={isSubmitting}>MAX</Btn>
        </div>
      </FF>
      <FF label="Date d'habillage">
        <Input type="date" value={habillageDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHabillageDate(e.target.value)} disabled={isSubmitting} />
      </FF>

      <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, padding: 16, marginBottom: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: "bold", color: T.accent, marginBottom: 12, textTransform: "uppercase" }}>Habillage (Unité)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Coiffe">
            <Select value={coiffeId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCoiffeId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans coiffe --</option>
              {coiffes.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
          <FF label="Étiquette">
            <Select value={etiquetteId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEtiquetteId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans étiquette --</option>
              {etiquettes.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
        </div>
        <div style={{ marginTop: 12 }}>
          <FF label="Contre-étiquette">
            <Select value={contreEtiquetteId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setContreEtiquetteId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans contre-étiquette --</option>
              {contreEtiquettes.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
        </div>
      </div>

      <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: "bold", color: T.textDim, marginBottom: 12, textTransform: "uppercase" }}>Mise en Carton</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <FF label="Format">
            <Select value={cartonSize} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCartonSize(e.target.value)} disabled={isSubmitting}>
              <option value="1">Unité (1)</option>
              <option value="3">Carton de 3</option>
              <option value="6">Carton de 6</option>
            </Select>
          </FF>
          <FF label="Modèle de carton">
            <Select value={cartonId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCartonId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans carton --</option>
              {cartons.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
        </div>
      </div>

      <FF label="Notes">
        <Input value={note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)} disabled={isSubmitting} placeholder="Commentaires opérateur" />
      </FF>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !count || !habillageDate || !eligibility.eligible} style={{ background: "#9960aa", borderColor: "#9960aa", color: "#fff" }}>
          {isSubmitting ? "Traitement..." : "Valider l'habillage"}
        </Btn>
      </div>
    </Modal>
  );
}

export function ExpedierModal({ bl, onClose }: { bl: any; onClose: any }) {
  const T = useTheme();
  const { dispatch, refreshData } = useStore();
  const { user } = useAuth();

  const [count, setCount] = useState("");
  const [expeditionDate, setExpeditionDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clientName, setClientName] = useState("");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const max = getBottleLotCount(bl);
  const eligibility = getExpeditionEligibility(bl);
  const qtyNum = parseInt(count);
  const quantityInvalid = !!count && (!qtyNum || qtyNum <= 0 || qtyNum > max);
  const location = [bl.zone || bl.locationZone, bl.palette || bl.locationPalette, bl.rack || bl.locationRack].filter(Boolean).join(" / ") || "--";

  const submit = async () => {
    if (!qtyNum || qtyNum <= 0 || qtyNum > max) return alert("Quantité invalide.");
    if (!clientName.trim()) return alert("Nom du client requis.");
    if (!expeditionDate) return alert("Date d'expédition requise.");
    if (!eligibility.eligible) return alert(`Lot non éligible: ${eligibility.reason}`);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bottles/expedier", {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          blId: parseInt(bl.id),
          count: qtyNum,
          expeditionDate,
          clientName,
          destination,
          note,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || errorData.error || "Erreur d'expédition");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Expédition bouteilles créée", color: T.green } });
      if (refreshData) await refreshData();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Expédition" onClose={onClose}>
      <div style={{ background: eligibility.eligible ? T.green + "11" : T.red + "11", border: `1px solid ${eligibility.eligible ? T.green + "33" : T.red + "33"}`, color: eligibility.eligible ? T.textStrong : T.red, borderRadius: 4, padding: 12, marginBottom: 16, fontSize: 12 }}>
        {eligibility.eligible ? "Lot éligible à l'expédition." : `Lot bloqué: ${eligibility.reason}.`}
      </div>
      <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 80px 90px 120px 1fr", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Lot</div>
            <div style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 700 }}>{bl.businessCode || bl.code}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Format</div>
            <div style={{ fontSize: 13, color: T.textStrong }}>{bl.format || bl.formatCode || "--"}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Stock</div>
            <div style={{ fontSize: 13, color: T.textStrong }}>{max} btl</div>
          </div>
          <div><Badge label={getBottleStatusLabel(bl.status, bl.type)} color={T.green} /></div>
          <div>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Emplacement</div>
            <div style={{ fontSize: 12, color: T.textDim }}>{location}</div>
          </div>
        </div>
      </div>
      <FF label={`Nombre (max ${max})`}>
        <div style={{ display: "flex", gap: 8 }}>
          <Input type="number" value={count} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCount(e.target.value)} disabled={isSubmitting} style={{ flex: 1, color: quantityInvalid ? T.red : T.text }} />
          <Btn variant="secondary" onClick={() => setCount(max.toString())} disabled={isSubmitting}>MAX</Btn>
        </div>
        {quantityInvalid && <div style={{ color: T.red, fontSize: 11, marginTop: 6 }}>Quantité invalide ou supérieure au stock disponible.</div>}
      </FF>
      <FF label="Date d'expédition">
        <Input type="date" value={expeditionDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpeditionDate(e.target.value)} disabled={isSubmitting} />
      </FF>
      <FF label="Nom du Client / Acheteur">
        <Input value={clientName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientName(e.target.value)} disabled={isSubmitting} />
      </FF>
      <FF label="Destination">
        <Input value={destination} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestination(e.target.value)} disabled={isSubmitting} placeholder="Optionnel" />
      </FF>
      <FF label="Notes">
        <Input value={note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)} disabled={isSubmitting} placeholder="Optionnel" />
      </FF>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !count || quantityInvalid || !clientName || !expeditionDate || !eligibility.eligible}>
          {isSubmitting ? "Traitement..." : "Valider l'expédition"}
        </Btn>
      </div>
    </Modal>
  );
}

export function StockBouteilles({ onSelectLot }: { onSelectLot?: any }) {
  const T = useTheme();
  const { state } = useStore();

  const [tab, setTab] = useState("vieillissement");
  const [modal, setModal] = useState<string | null>(null);
  const [selBl, setSelBl] = useState<any>(null);

  const bottleLots = (state.bottleLots || []).filter((b: any) => getBottleLotCount(b) > 0);
  const vieillissement = bottleLots.filter((b: any) => normalizeBottleLotStatus(b.status, b.type) === "SUR_LATTES");
  const aHabiller = bottleLots.filter((b: any) => normalizeBottleLotStatus(b.status, b.type) === "DEGORGE");
  const finis = bottleLots.filter((b: any) => normalizeBottleLotStatus(b.status, b.type) === "PRET_EXPEDITION");
  const reserves = bottleLots.filter((b: any) => normalizeBottleLotStatus(b.status, b.type) === "RESERVE");

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>Stock Bouteilles</h1>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {["vieillissement", "habillage", "finis", "reserves"].map((t) => {
          const labels: Record<string, string> = {
            vieillissement: `VIEILLISSEMENT (${vieillissement.length})`,
            habillage: `À HABILLER (${aHabiller.length})`,
            finis: `PRÊTS (${finis.length})`,
            reserves: `VINS DE RÉSERVE (${reserves.length})`,
          };

          return (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? T.accent : "transparent", color: tab === t ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition: "all .2s" }}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {tab === "vieillissement" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 70px 90px 100px 1fr 100px 180px", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
            <div>Code Tirage</div><div>Format</div><div>Stock</div><div>Statut</div><div>Emplacement</div><div>Tirage (Âge)</div><div>Action (Cycle)</div>
          </div>
          {vieillissement.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: T.textDim }}>Aucune bouteille en vieillissement.</div> : vieillissement.map((b: any, i: number) => {
            const eligibility = getDegorgementEligibility(b);
            const age = eligibility.ageMonths;
            const btlCount = getBottleLotCount(b);

            return (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "2fr 70px 90px 100px 1fr 100px 180px", padding: "14px 16px", alignItems: "center", borderBottom: i < vieillissement.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{b.code || b.businessCode}</div>
                <div style={{ fontSize: 13, color: T.text }}>{b.format || b.formatCode}</div>
                <div style={{ fontSize: 14, color: T.textStrong, fontWeight: "bold" }}>{btlCount}</div>
                <div><Badge label={getBottleStatusLabel(b.status, b.type)} color={BOTTLE_STATUS_COLORS[normalizeBottleLotStatus(b.status, b.type)] || T.textDim} /></div>
                <div style={{ fontSize: 12, color: T.textDim }}>{b.zone || b.locationZone || "--"}</div>
                <div style={{ fontSize: 12, color: eligibility.eligible ? T.accent : T.textDim, fontWeight: eligibility.eligible ? "bold" : "normal" }}>{b.tirageDate ? `${age} mois` : "--"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn variant={eligibility.eligible ? "primary" : "secondary"} style={{ fontSize: 10, padding: "6px 8px", width: "100%", opacity: eligibility.eligible ? 1 : 0.65 }} disabled={!eligibility.eligible} onClick={() => { setSelBl(b); setModal("degorger"); }}>
                    {eligibility.eligible ? "DÉGORGER" : eligibility.reason}
                  </Btn>
                  {!eligibility.eligible && (
                    <div style={{ fontSize: 10, color: T.textDim }}>
                      {eligibility.reasonCode === "TOO_YOUNG" ? `Minimum ${MIN_SUR_LATTES_MONTHS} mois` : "Action bloquée"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "habillage" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 120px 140px 1fr 110px", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
            <div>Code Lot</div><div>Format</div><div>Stock (Nues)</div><div>Emplacement</div><div>Statut</div><div>Action</div>
          </div>
          {aHabiller.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: T.textDim }}>Aucune bouteille nue en attente d'habillage.</div> : aHabiller.map((b: any, i: number) => {
            const eligibility = getHabillageEligibility(b);
            return (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "2fr 80px 120px 140px 1fr 110px", padding: "14px 16px", alignItems: "center", borderBottom: i < aHabiller.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{b.code || b.businessCode}</div>
                <div style={{ fontSize: 13, color: T.text }}>{b.format || b.formatCode}</div>
                <div style={{ fontSize: 15, color: T.textStrong, fontWeight: "bold" }}>{getBottleLotCount(b)} btl</div>
                <div style={{ fontSize: 12, color: T.textDim }}>{b.zone || b.locationZone || "--"}</div>
                <div><Badge label={getBottleStatusLabel(b.status, b.type)} color={BOTTLE_STATUS_COLORS[normalizeBottleLotStatus(b.status, b.type)]} /></div>
                <div>
                  <Btn variant="primary" disabled={!eligibility.eligible} style={{ fontSize: 10, padding: "6px 12px", width: "100%", background: "#9960aa", borderColor: "#9960aa", opacity: eligibility.eligible ? 1 : 0.65 }} onClick={() => { setSelBl(b); setModal("habiller"); }}>
                    HABILLER
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "finis" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 120px 140px 1fr 110px", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
            <div>Code Dégorgement</div><div>Format</div><div>Stock Dispo</div><div>Date Dégorg.</div><div>Dosage</div><div>Action</div>
          </div>
          {finis.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: T.textDim }}>Aucun produit fini prêt à l'expédition.</div> : finis.map((b: any, i: number) => {
            const eligibility = getExpeditionEligibility(b);
            return (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "2fr 80px 120px 140px 1fr 110px", padding: "14px 16px", alignItems: "center", borderBottom: i < finis.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{b.code || b.businessCode}</div>
                <div style={{ fontSize: 13, color: T.text }}>{b.format || b.formatCode}</div>
                <div style={{ fontSize: 15, color: T.textStrong, fontWeight: "bold" }}>{getBottleLotCount(b)} btl</div>
                <div style={{ fontSize: 11, color: T.textDim, fontFamily: "monospace" }}>{b.degorgDate || b.degorgementDate ? new Date(b.degorgDate || b.degorgementDate).toLocaleDateString("fr-FR") : "--"}</div>
                <div style={{ fontSize: 12, color: T.textDim }}>{b.dosage || (b.dosageValue ? `${b.dosageValue} g/L` : "--")}</div>
                <div><Btn variant="primary" disabled={!eligibility.eligible} style={{ fontSize: 10, padding: "6px 12px", width: "100%", opacity: eligibility.eligible ? 1 : 0.65 }} onClick={() => { setSelBl(b); setModal("expedier"); }}>EXPÉDIER</Btn></div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "reserves" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 120px 140px 1fr", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
            <div>Code Lot (Réserve)</div><div>Format</div><div>Stock Actuel</div><div>Date Tirage</div><div>Emplacement</div>
          </div>
          {reserves.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.textDim }}>Aucun vin de réserve en bouteilles.</div>
          ) : reserves.map((b: any, i: number) => (
            <div key={b.id} style={{ display: "grid", gridTemplateColumns: "2fr 80px 120px 140px 1fr", padding: "14px 16px", alignItems: "center", borderBottom: i < reserves.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{b.code || b.businessCode}</div>
              <div style={{ fontSize: 13, color: T.text }}>{b.format || b.formatCode}</div>
              <div style={{ fontSize: 15, color: T.textStrong, fontWeight: "bold" }}>{getBottleLotCount(b)} btl</div>
              <div style={{ fontSize: 11, color: T.textDim, fontFamily: "monospace" }}>{b.tirageDate ? new Date(b.tirageDate).toLocaleDateString("fr-FR") : "--"}</div>
              <div style={{ fontSize: 12, color: T.textDim }}>{b.zone || b.locationZone || "--"}</div>
            </div>
          ))}
        </div>
      )}

      {modal === "degorger" && selBl && <DegorgerModal bl={selBl} onClose={() => setModal(null)} />}
      {modal === "habiller" && selBl && <HabillerModal bl={selBl} onClose={() => setModal(null)} />}
      {modal === "expedier" && selBl && <ExpedierModal bl={selBl} onClose={() => setModal(null)} />}
    </div>
  );
}
