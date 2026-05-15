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

export function LotEventMetadataDetails({ metadata }: { metadata?: unknown }) {
  const T = useTheme();

  if (!isObject(metadata)) {
    return null;
  }

  const operation = String(metadata.operation || "").toUpperCase();
  if (operation !== "EXPEDITION_VRAC") {
    return null;
  }

  const rows: Array<[string, string | null]> = [
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
