"use client";

import React from "react";
import { useTheme } from "@/lib/store";

type JsonObject = Record<string, any>;

const isObject = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPresent = (value: unknown) => value !== null && value !== undefined && value !== "";

const formatNumber = (value: unknown, suffix = "") => {
  if (!isPresent(value)) return null;
  if (typeof value === "number") {
    const display = Number.isInteger(value)
      ? value.toString()
      : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
    return `${display}${suffix}`;
  }
  return `${value}${suffix}`;
};

const formatTransferDestinations = (value: unknown) => {
  if (!Array.isArray(value)) return null;

  const destinations = value
    .filter(isObject)
    .map((destination) => {
      const lot = destination.lotId ? `lot #${destination.lotId}` : "lot cible";
      const container = destination.containerId ? `cuve #${destination.containerId}` : "cuve cible";
      const volume = formatNumber(destination.volumeHl, " hL");
      const status = destination.status ? ` · ${destination.status}` : "";
      return `${lot} → ${container}${volume ? ` · ${volume}` : ""}${status}`;
    });

  return destinations.length > 0 ? destinations.join(" / ") : null;
};

const formatTirageItems = (value: unknown) => {
  if (!Array.isArray(value)) return null;

  const items = value
    .filter(isObject)
    .map((item) => {
      const label = item.productName || item.label || item.kind || "Intrant";
      const quantity = formatNumber(item.quantity, item.unit ? ` ${item.unit}` : "");
      return quantity ? `${label} · ${quantity}` : String(label);
    });

  return items.length > 0 ? items.join(" / ") : null;
};

const formatPercentages = (value: unknown) => {
  if (!isObject(value)) return null;

  const items = Object.entries(value)
    .filter(([, percentage]) => isPresent(percentage))
    .map(([label, percentage]) => `${label} ${formatNumber(percentage, " %")}`);

  return items.length > 0 ? items.join(" / ") : null;
};

const formatAssemblageSources = (value: unknown, role: string) => {
  if (!Array.isArray(value)) return null;

  const sources = value
    .filter(isObject)
    .filter((source) => String(source.sourceRole || "").toUpperCase() === role)
    .map((source) => {
      const label =
        source.sourceType === "BOTTLE_LOT"
          ? source.bottleLotCode || (source.bottleLotId ? `lot bouteille #${source.bottleLotId}` : "lot bouteille")
          : source.lotCode || (source.lotId ? `lot #${source.lotId}` : "lot");
      const volume = formatNumber(source.volumeHl, " hL");
      const bottles = formatNumber(source.bottleCount, " btl");
      const format = source.format ? ` · ${source.format}` : "";
      return `${label}${volume ? ` · ${volume}` : ""}${bottles ? ` · ${bottles}` : ""}${format}`;
    });

  return sources.length > 0 ? sources.join(" / ") : null;
};

export function LotEventMetadataDetails({ metadata }: { metadata?: unknown }) {
  const T = useTheme();

  if (!isObject(metadata)) {
    return null;
  }

  const operation = String(metadata.operation || "").toUpperCase();
  if (
    operation !== "EXPEDITION_VRAC" &&
    operation !== "INTRANT" &&
    operation !== "TRANSFERT" &&
    operation !== "CORRECTION_VOLUME" &&
    operation !== "TIRAGE" &&
    operation !== "ASSEMBLAGE"
  ) {
    return null;
  }

  const rows: Array<[string, string | null]> =
    operation === "INTRANT"
      ? [
          ["Intrant", metadata.intrant || null],
          ["Quantité", formatNumber(metadata.quantity)],
          ["Unité", metadata.unit || null],
          ["Note", metadata.note || null],
        ]
      : operation === "TRANSFERT"
        ? [
            ["Lot source", metadata.sourceLotId ? `#${metadata.sourceLotId}` : null],
            ["Cuve source", metadata.sourceContainerId ? `#${metadata.sourceContainerId}` : null],
            ["Volume demandé", formatNumber(metadata.requestedVolumeHl, " hL")],
            ["Volume transféré", formatNumber(metadata.transferredVolumeHl, " hL")],
            ["Reliquat", formatNumber(metadata.remainingVolumeHl, " hL")],
            ["Statut reliquat", metadata.remainderStatus || null],
            ["Destinations", formatTransferDestinations(metadata.destinations)],
            ["Note", metadata.note || null],
          ]
      : operation === "CORRECTION_VOLUME"
        ? [
            ["Ancien volume", formatNumber(metadata.previousVolumeHl, " hL")],
            ["Nouveau volume", formatNumber(metadata.newVolumeHl, " hL")],
            ["Delta", formatNumber(metadata.deltaHl, " hL")],
            ["Sens", metadata.eventType === "CORRECTION_HAUSSE" ? "Hausse" : metadata.eventType === "CORRECTION_BAISSE" ? "Baisse" : null],
            ["Contenant", metadata.containerId ? `#${metadata.containerId}` : null],
            ["Raison", metadata.reason || null],
            ["Note", metadata.note || null],
          ]
      : operation === "TIRAGE"
        ? [
            ["Lot source", metadata.sourceLotId ? `#${metadata.sourceLotId}` : null],
            ["Lot bouteille", metadata.bottleLotCode || (metadata.bottleLotId ? `#${metadata.bottleLotId}` : null)],
            ["Format", metadata.format || null],
            ["Bouteilles", formatNumber(metadata.bottleCount, " btl")],
            ["Volume demandé", formatNumber(metadata.requestedVolumeHl, " hL")],
            ["Volume consommé", formatNumber(metadata.consumedVolumeHl, " hL")],
            ["Volume restant", formatNumber(metadata.remainingVolumeHl, " hL")],
            ["Pression cible", formatNumber(metadata.pressureTargetBars, " bar")],
            ["Bouchage", metadata.bouchage || null],
            ["Consommables", formatTirageItems(metadata.stockItems)],
            ["Intrants calculés", formatTirageItems(metadata.calculatedItems)],
            ["Note", metadata.note || null],
          ]
      : operation === "ASSEMBLAGE"
        ? [
            ["Lot assemblé", metadata.targetLotCode || (metadata.targetLotId ? `#${metadata.targetLotId}` : null)],
            ["Cuve destination", metadata.targetContainerCode || (metadata.targetContainerId ? `#${metadata.targetContainerId}` : null)],
            ["Volume total", formatNumber(metadata.volumeTotalHl, " hL")],
            ["Type demandé", metadata.assemblageTypeRequested || null],
            ["Type suggéré", metadata.suggestedType || null],
            ["Composition cépage", formatPercentages(metadata.compositionByCepage)],
            ["Composition millésime", formatPercentages(metadata.compositionByVintage)],
            ["Part réserve", formatNumber(metadata.reserveShare, " %")],
            ["Part vin rouge", formatNumber(metadata.redWineShare, " %")],
            ["Sources principales", formatAssemblageSources(metadata.components, "MAIN")],
            ["Sources réserve", formatAssemblageSources(metadata.components, "RESERVE")],
            ["Sources rosé", formatAssemblageSources(metadata.components, "ROSE")],
            ["Adjuvants", formatTirageItems(metadata.adjuvants)],
            ["Alertes", Array.isArray(metadata.warnings) && metadata.warnings.length > 0 ? metadata.warnings.join(" / ") : null],
            ["Note", metadata.note || null],
          ]
      : [
          ["Volume expédié", formatNumber(metadata.volumeHl, " hL")],
          ["Client", metadata.client || null],
          ["Destination", metadata.destination || null],
          ["Mode", metadata.mode || null],
          ["Contenant source", metadata.containerCode || (metadata.containerId ? `#${metadata.containerId}` : null)],
          ["Type contenant", metadata.containerType || null],
          ["Volume avant", formatNumber(metadata.previousLotVolumeHl, " hL")],
          ["Volume après", formatNumber(metadata.remainingLotVolumeHl, " hL")],
          ["Statut avant", metadata.previousLotStatus || null],
          ["Statut après", metadata.newLotStatus || null],
        ];

  const visibleRows = rows.filter(([, value]) => isPresent(value));
  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", color: T.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
        Détails structurés
      </summary>
      <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: 4, background: T.surfaceHigh, padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
          {visibleRows.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 11, color: T.textStrong, fontFamily: "monospace", marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
