"use client";
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { Btn, FF, Input, Modal, Select } from "@/components/ui";
import { useAuth, useStore, useTheme } from "@/lib/store";
import { buildApiHeaders, buildTirageStockItems, getLotCode, toSafeNumber } from "@/lib/client-app-helpers";
import { calculateTiragePlan, isTirageEligibleLotStatus } from "@/lib/tirage";

export function DirectTirageModal({
  lot,
  container,
  bulkVol,
  onClose,
}: {
  lot: any;
  container: any;
  bulkVol: number;
  onClose: () => void;
}) {
  const T = useTheme();
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();

  const [tirageForm, setTirageForm] = useState({
    typeMise: "EFFERVESCENT",
    format: "75cl",
    volume: "",
    count: "",
    bouchage: "Capsule",
    modeleBouchage: "",
    zone: "",
    note: "",
  });
  const [tirageSubmitError, setTirageSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    setTirageSubmitError(null);
  }, [tirageForm.typeMise, tirageForm.format, tirageForm.volume, tirageForm.bouchage, lot.id]);

  const tirageRequestedVolume = toSafeNumber(tirageForm.volume);
  const tiragePlanPreview = calculateTiragePlan({
    requestedVolumeHl: tirageRequestedVolume,
    formatCode: tirageForm.format,
  });
  const tirageBottleCount = tiragePlanPreview.bottleCount;
  const tiragePackagingStock = buildTirageStockItems(
    state.products || [],
    tirageForm.format,
    tirageForm.bouchage,
    tirageBottleCount,
  );
  const isLotTirageEligible = isTirageEligibleLotStatus(lot.status);
  const tirageBottleStock = tiragePackagingStock.bottleProduct ? toSafeNumber(tiragePackagingStock.bottleProduct.currentStock) : 0;
  const tiragePrimaryClosureStock = tiragePackagingStock.primaryClosureProduct ? toSafeNumber(tiragePackagingStock.primaryClosureProduct.currentStock) : 0;
  const tirageSecondaryClosureStock = tiragePackagingStock.secondaryClosureProduct ? toSafeNumber(tiragePackagingStock.secondaryClosureProduct.currentStock) : 0;
  const isBottleStockShortage = tirageBottleCount > tirageBottleStock;
  const isPrimaryClosureShortage = tirageBottleCount > tiragePrimaryClosureStock;
  const isSecondaryClosureShortage = tirageBottleCount > tirageSecondaryClosureStock;
  const isTirageStockShortage =
    tirageBottleCount > 0 &&
    (
      tiragePackagingStock.missing.length > 0 ||
      isBottleStockShortage ||
      isPrimaryClosureShortage ||
      isSecondaryClosureShortage
    );
  const tirageForecastItems = [
    tiragePackagingStock.bottleProduct
      ? {
          label: tiragePackagingStock.bottleProduct.name,
          quantity: tirageBottleCount,
          unit: tiragePackagingStock.bottleProduct.unit,
          available: tirageBottleStock,
        }
      : null,
    tiragePackagingStock.primaryClosureProduct
      ? {
          label: tiragePackagingStock.primaryClosureProduct.name,
          quantity: tirageBottleCount,
          unit: tiragePackagingStock.primaryClosureProduct.unit,
          available: tiragePrimaryClosureStock,
        }
      : null,
    tiragePackagingStock.secondaryClosureProduct
      ? {
          label: tiragePackagingStock.secondaryClosureProduct.name,
          quantity: tirageBottleCount,
          unit: tiragePackagingStock.secondaryClosureProduct.unit,
          available: tirageSecondaryClosureStock,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; quantity: number; unit: string; available: number }>;

  const submitTirage = async () => {
    setIsSubmitting(true);
    setTirageSubmitError(null);

    try {
      if (!isLotTirageEligible) {
        throw new Error(`Ce lot n'est pas éligible au tirage. Statut actuel : ${lot.status}.`);
      }
      if (isTirageStockShortage) {
        throw new Error("Les stocks de tirage sont insuffisants pour cette opération.");
      }

      const isTranquille = tirageForm.typeMise === "TRANQUILLE";
      const finalNote = isTranquille
        ? `Mise en bouteille tranquille (${tirageForm.bouchage}). ${tirageForm.note || ""}`
        : `Tirage effervescent (${tirageForm.bouchage}). ${tirageForm.note || ""}`;

      if (!tirageRequestedVolume || tirageRequestedVolume <= 0 || tirageBottleCount <= 0) {
        throw new Error("Le volume saisi ne permet pas de produire de bouteilles avec ce format.");
      }

      const payload = {
        lotId: lot.id,
        sourceContainerId: lot.currentContainerId || lot.containerId || null,
        format: tirageForm.format,
        count: tirageBottleCount,
        volume: tirageRequestedVolume,
        bouchage: tirageForm.bouchage,
        zone: container?.zone || null,
        tirageDate: new Date().toISOString(),
        note: finalNote,
        isTranquille,
        stockItems: tiragePackagingStock.items,
        calculatedItems: [],
        planningMeta: {
          source: "DIRECT",
          requestedVolumeHl: tirageRequestedVolume,
          theoreticalConsumedVolumeHl: tiragePlanPreview.consumedVolumeHl,
          theoreticalRemainderHl: tiragePlanPreview.remainderVolumeHl,
          sourceLotCode: getLotCode(lot),
        },
        idempotencyKey: idempotencyKey || crypto.randomUUID(),
      };

      const res = await fetch("/api/tirage", {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Une erreur est survenue lors du tirage.");
      }

      dispatch({
        type: "TOAST_ADD",
        payload: { msg: `Tirage validé ! Lot créé : ${data.bottleLotCode}`, color: "#2d6640" },
      });

      onClose();
      if (refreshData) await refreshData();
    } catch (e: any) {
      const message = e?.message || "Une erreur est survenue lors du tirage.";
      setTirageSubmitError(message);
      dispatch({
        type: "TOAST_ADD",
        payload: { msg: `Erreur : ${message}`, color: "#d93025" },
      });
    } finally {
      setIsSubmitting(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  const isTranquille = tirageForm.typeMise === "TRANQUILLE";
  const baseYear = parseInt(lot.year || lot.millesime) || parseInt((lot.businessCode || lot.code).substring(0, 4)) || new Date().getFullYear();
  const nextYear = baseYear + 1;
  const releaseDate = new Date(`${nextYear}-01-01T00:00:00Z`);
  const isTirageBlockedAOC = !isTranquille && new Date() < releaseDate;

  return (
    <Modal title={isTranquille ? "Mise en Bouteille (Vin Tranquille)" : "Tirage (Prise de mousse)"} onClose={onClose}>
      {!isLotTirageEligible && (
        <div style={{ background: T.red + "15", border: `1px solid ${T.red}55`, borderRadius: 4, padding: 14, marginBottom: 16 }}>
          <div style={{ color: T.red, fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Lot non éligible au tirage</div>
          <div style={{ color: T.red, fontSize: 11, lineHeight: 1.4 }}>
            Ce lot n'est pas éligible au tirage. Statut actuel : {lot.status}.
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 16 }}>
        <FF label="Type de mise en bouteille">
          <Select value={tirageForm.typeMise} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTirageForm({ ...tirageForm, typeMise: e.target.value })} disabled={isSubmitting} style={{ fontWeight: "bold", color: isTranquille ? "#8b1c31" : T.accent }}>
            <option value="EFFERVESCENT">Prise de mousse (Champagne)</option>
            <option value="TRANQUILLE">Vin Tranquille (Coteaux / Rouge)</option>
          </Select>
        </FF>
        {isTranquille && (
          <div style={{ fontSize: 11, color: "#8b1c31", marginTop: 8, fontStyle: "italic" }}>
            ℹ️ Ce lot contournera l'étape de dégorgement et ira directement "En Cave".
          </div>
        )}
      </div>

      {isTirageBlockedAOC && (
        <div style={{ background: T.red + "15", border: `1px solid ${T.red}55`, borderRadius: 4, padding: 14, marginBottom: 16 }}>
          <div style={{ color: T.red, fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>🚨 Blocage AOC : Tirage prématuré</div>
          <div style={{ color: T.red, fontSize: 11, lineHeight: 1.4 }}>
            Le tirage pour la prise de mousse d'un vin de base de la vendange {baseYear} est strictement interdit avant le 1er janvier {nextYear}.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FF label="Format">
          <Select value={tirageForm.format} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTirageForm({ ...tirageForm, format: e.target.value })} disabled={isSubmitting}>
            {["37.5cl", "75cl", "150cl"].map((f: any) => <option key={f}>{f}</option>)}
          </Select>
        </FF>
        <FF label={`Volume hL (Max ${bulkVol})`}>
          <Input type="number" step="0.1" value={tirageForm.volume} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageForm({ ...tirageForm, volume: e.target.value })} disabled={isSubmitting} />
        </FF>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
        <FF label="Bouteilles calculées">
          <Input value={tirageBottleCount ? tirageBottleCount.toLocaleString("fr-FR") : "0"} disabled={true} />
        </FF>
        <FF label="Volume consommé réel">
          <Input value={`${tiragePlanPreview.consumedVolumeHl.toFixed(3)} hL`} disabled={true} />
        </FF>
        <FF label="Reliquat théorique">
          <Input value={`${tiragePlanPreview.remainderVolumeHl.toFixed(3)} hL`} disabled={true} />
        </FF>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 8 }}>
        <FF label="Type de bouchage">
          <Select value={tirageForm.bouchage} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTirageForm({ ...tirageForm, bouchage: e.target.value })} disabled={isSubmitting}>
            {!isTranquille && <option value="Capsule">Capsule</option>}
            <option value="Liège">Liège</option>
          </Select>
        </FF>
        <FF label="Modèle (Marque - Réf)">
          <Input value={tirageForm.modeleBouchage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageForm({ ...tirageForm, modeleBouchage: e.target.value })} disabled={isSubmitting} placeholder="Ex: Trescases - 29x29" />
        </FF>
      </div>

      <FF label="Notes (Optionnel)">
        <Input value={tirageForm.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageForm({ ...tirageForm, note: e.target.value })} disabled={isSubmitting} placeholder="Ex: Ajout de levures spécifiques..." />
      </FF>

      {tirageBottleCount > 0 && (
        <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14 }}>
          <div style={{ color: T.textStrong, fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>Consommation prévue</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tirageForecastItems.map((item) => {
              const remaining = Math.max(0, item.available - item.quantity);
              const isShortage = item.available + 0.0001 < item.quantity;
              return (
                <div key={item.label} style={{ display: "grid", gridTemplateColumns: "1.2fr 120px 140px", gap: 12, fontSize: 12, color: isShortage ? T.red : T.textDim }}>
                  <div style={{ color: T.textStrong }}>{item.label}</div>
                  <div style={{ fontFamily: "monospace" }}>{item.quantity.toLocaleString("fr-FR")} {item.unit}</div>
                  <div style={{ fontFamily: "monospace" }}>
                    {item.available.toLocaleString("fr-FR")} {"->"} {remaining.toLocaleString("fr-FR")} {item.unit}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 10, lineHeight: 1.5 }}>
            Ce tirage utilisera la même route <strong>/api/tirage</strong> que la planification et décrémentera le lot selon le volume réellement consommé.
          </div>
        </div>
      )}

      {isTirageStockShortage && tirageBottleCount > 0 && (
        <div style={{ background: T.red + "15", border: `1px solid ${T.red}55`, borderRadius: 4, padding: 14 }}>
          <div style={{ color: T.red, fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>Stock insuffisant pour ce tirage :</div>
          <ul style={{ color: T.red, fontSize: 12, margin: 0, paddingLeft: 20 }}>
            {tiragePackagingStock.missing.map((missingLabel: any) => <li key={missingLabel}>{missingLabel} introuvable au catalogue.</li>)}
            {isBottleStockShortage && tiragePackagingStock.bottleProduct && <li>Manque {(tirageBottleCount - tirageBottleStock).toLocaleString("fr-FR")} bouteilles (en stock: {tirageBottleStock.toLocaleString("fr-FR")}).</li>}
            {isPrimaryClosureShortage && tiragePackagingStock.primaryClosureProduct && <li>Manque {(tirageBottleCount - tiragePrimaryClosureStock).toLocaleString("fr-FR")} {tiragePackagingStock.primaryClosureProduct.name} (en stock: {tiragePrimaryClosureStock.toLocaleString("fr-FR")}).</li>}
            {isSecondaryClosureShortage && tiragePackagingStock.secondaryClosureProduct && <li>Manque {(tirageBottleCount - tirageSecondaryClosureStock).toLocaleString("fr-FR")} {tiragePackagingStock.secondaryClosureProduct.name} (en stock: {tirageSecondaryClosureStock.toLocaleString("fr-FR")}).</li>}
          </ul>
        </div>
      )}

      {tirageSubmitError && (
        <div style={{ background: T.red + "15", border: `1px solid ${T.red}55`, borderRadius: 4, padding: 14 }}>
          <div style={{ color: T.red, fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>Dernière erreur backend</div>
          <div style={{ color: T.red, fontSize: 12, lineHeight: 1.5 }}>{tirageSubmitError}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submitTirage} disabled={isSubmitting || !tirageForm.volume || isTirageBlockedAOC || !isLotTirageEligible || isTirageStockShortage || tirageBottleCount <= 0}>
          {isSubmitting ? "Tirage en cours..." : "Valider le tirage"}
        </Btn>
      </div>
    </Modal>
  );
}
