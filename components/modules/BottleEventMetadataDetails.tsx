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
    const display = Number.isInteger(value) ? value.toString() : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
    return `${display}${suffix}`;
  }
  return `${value}${suffix}`;
};

const getProductLabel = (item: JsonObject) => {
  const quantity = formatNumber(item.quantity);
  const unit = item.unit ? ` ${item.unit}` : "";
  const label = item.productName || item.label || item.kind || (item.productId ? `Produit #${item.productId}` : "Consommable");
  return `${label}${quantity ? ` · ${quantity}${unit}` : ""}`;
};

export function BottleEventMetadataDetails({ metadata }: { metadata?: unknown }) {
  const T = useTheme();

  if (!isObject(metadata)) {
    return null;
  }

  const operation = String(metadata.operation || "").toUpperCase();
  const rows: Array<[string, string | null]> = [];
  let listTitle = "";
  let listItems: JsonObject[] = [];

  if (operation === "DEGORGEMENT") {
    rows.push(
      ["Quantité", formatNumber(metadata.quantity, " btl")],
      ["Pertes", formatNumber(metadata.losses, " btl")],
      ["Dosage", formatNumber(metadata.dosageGPerL, " g/L")],
      ["Liqueur", metadata.liqueurType || null],
      ["Volume liqueur", formatNumber(metadata.liqueurVolumeL, " L")],
    );
    listTitle = "Consommables";
    listItems = Array.isArray(metadata.consumables) ? metadata.consumables : [];
  } else if (operation === "HABILLAGE") {
    rows.push(
      ["Quantité", formatNumber(metadata.quantity, " btl")],
      ["Cartons", isObject(metadata.packaging) ? formatNumber(metadata.packaging.cartons) : null],
      ["Format carton", isObject(metadata.packaging) ? formatNumber(metadata.packaging.cartonSize, " btl") : null],
    );
    listTitle = "Consommables";
    listItems = Array.isArray(metadata.consumables) ? metadata.consumables : [];
  } else if (operation === "EXPEDITION") {
    rows.push(
      ["Quantité", formatNumber(metadata.quantity, " btl")],
      ["Client", metadata.customer || null],
      ["Destination", metadata.destination || null],
      ["Shipment", metadata.shipmentId ? `#${metadata.shipmentId}` : null],
    );
  } else if (operation === "TIRAGE") {
    rows.push(
      ["Format", metadata.format || null],
      ["Bouteilles", formatNumber(metadata.bottleCount ?? metadata.quantity, " btl")],
      ["Volume consommé", formatNumber(metadata.consumedVolumeHl, " hL")],
      ["Pression", formatNumber(metadata.pressureTargetBars, " bar")],
      ["Bouchage", metadata.bouchage || null],
    );
    listTitle = "Intrants";
    listItems = [
      ...(Array.isArray(metadata.stockItems) ? metadata.stockItems : []),
      ...(Array.isArray(metadata.calculatedItems) ? metadata.calculatedItems : []),
    ];
  } else {
    return null;
  }

  const visibleRows = rows.filter(([, value]) => isPresent(value));
  if (visibleRows.length === 0 && listItems.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: 4, background: T.surfaceHigh, padding: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        {visibleRows.map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 11, color: T.textStrong, fontFamily: "monospace", marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {listItems.length > 0 && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{listTitle}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {listItems.map((item, index) => (
              <div key={`${item.productId || item.kind || item.label || index}-${index}`} style={{ fontSize: 11, color: T.text }}>
                {getProductLabel(item)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
