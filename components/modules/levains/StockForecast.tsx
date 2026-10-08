"use client";
import type { LevainData } from "./types";
import type { LiqueurSelection } from "@/lib/levain-types";
import { calculateLiqueurPreparation } from "@/lib/liqueur";
export type ForecastDebits = {
  lots: Array<{ id: number; quantity: number }>;
  products: Array<{ id: number; quantity: number; unit: "kg" | "hL" }>;
};
export function addLiqueurForecast(
  debits: ForecastDebits,
  selection: LiqueurSelection,
  volumeHl: number,
) {
  if (selection.mode === "PREPARED")
    debits.products.push({
      id: selection.productId,
      quantity: volumeHl,
      unit: "hL",
    });
  else {
    const r = calculateLiqueurPreparation(
      volumeHl,
      selection.sugarGfPerL,
      selection.dissolutionWineAlcoholPct,
    );
    if (r) {
      debits.products.push({
        id: selection.sugarProductId,
        quantity: r.sugarKg,
        unit: "kg",
      });
      debits.lots.push({
        id: selection.dissolutionLotId,
        quantity: r.dissolutionWineVolumeHl,
      });
    }
  }
}
export function StockForecast({
  data,
  debits,
}: {
  data: LevainData;
  debits: ForecastDebits;
}) {
  const rows = new Map<
    string,
    { name: string; needed: number; available: number; unit: string }
  >();
  for (const d of debits.lots) {
    const lot = [...data.wines, ...data.items].find((l) => l.lotId === d.id);
    if (!lot || d.quantity <= 0) continue;
    const key = `lot-${d.id}`,
      previous = rows.get(key);
    rows.set(key, {
      name: `${lot.name} (${lot.containerName})`,
      needed: (previous?.needed ?? 0) + Number(d.quantity.toFixed(3)),
      available: lot.volumeHl,
      unit: "hL",
    });
  }
  for (const d of debits.products) {
    const p = data.products.find((p) => p.id === d.id);
    if (!p || d.quantity <= 0) continue;
    const factor =
      d.unit === "kg" && p.unit.toLowerCase() === "g"
        ? 1000
        : d.unit === "hL" && p.unit.toLowerCase() === "l"
          ? 100
          : 1;
    const key = `product-${d.id}`,
      previous = rows.get(key);
    rows.set(key, {
      name: p.name,
      needed:
        (previous?.needed ?? 0) + Number((d.quantity * factor).toFixed(3)),
      available: p.currentStock,
      unit: p.unit,
    });
  }
  return (
    <div aria-label="Prévision des stocks">
      {[...rows].map(([key, r]) => (
        <p key={key} role={r.needed > r.available ? "alert" : undefined}>
          {r.name} : nécessaire {r.needed.toFixed(3)} {r.unit} · disponible{" "}
          {r.available} {r.unit} · reste {(r.available - r.needed).toFixed(3)}{" "}
          {r.unit}
          {r.needed > r.available ? " — stock insuffisant" : ""}
        </p>
      ))}
    </div>
  );
}
