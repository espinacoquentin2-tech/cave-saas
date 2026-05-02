"use client";
// @ts-nocheck

import React from "react";
import { Btn, FF, Input, Select } from "@/components/ui";
import { useTheme } from "@/lib/store";

export function AssemblageAdjuvants({
  adjuvantRows,
  setAdjuvants,
  products,
  totalVolumeHl,
  isSubmitting,
}: any) {
  const T = useTheme();

  return (
    <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, gap:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.textStrong }}>E. Adjuvants</div>
        <Btn variant="secondary" onClick={() => setAdjuvants((prev: any[]) => [...prev, { productId:"", dose:"", doseUnit:"g/hL", treatedVolumeHl: totalVolumeHl ? totalVolumeHl.toFixed(2) : "", quantityUnit:"" }])} disabled={isSubmitting}>
          Ajouter un adjuvant
        </Btn>
      </div>
      {adjuvantRows.length === 0 ? (
        <div style={{ fontSize:12, color:T.textDim }}>Aucun adjuvant prévu pour cet assemblage.</div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {adjuvantRows.map((row: any) => (
            <div key={`adjuvant-${row.index}`} style={{ border:`1px solid ${row.stockShortage ? T.red : T.border}`, borderRadius:6, padding:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1.5fr 100px 110px 110px 130px 48px", gap:10, alignItems:"end" }}>
                <FF label="Produit">
                  <Select
                    value={row.productId || ""}
                    disabled={isSubmitting}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const product = (products || []).find((candidate: any) => String(candidate.id) === e.target.value);
                      setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, productId: e.target.value, quantityUnit: product?.unit || "" } : candidate));
                    }}
                  >
                    <option value="">-- Produit œnologique --</option>
                    {(products || []).filter((product: any) => product.category === "Intrants").map((product: any) => (
                      <option key={product.id} value={product.id}>{product.name} ({Number(product.currentStock || 0).toFixed(2)} {product.unit})</option>
                    ))}
                  </Select>
                </FF>
                <FF label="Dose">
                  <Input type="number" step="0.01" value={row.dose || ""} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, dose: e.target.value } : candidate))} />
                </FF>
                <FF label="Unité dose">
                  <Select value={row.doseUnit || "g/hL"} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, doseUnit: e.target.value } : candidate))}>
                    {["g/hL", "kg/hL", "mL/hL", "L/hL"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </Select>
                </FF>
                <FF label="Volume traité">
                  <Input type="number" step="0.01" value={row.treatedVolumeHl || ""} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, treatedVolumeHl: e.target.value } : candidate))} />
                </FF>
                <FF label={`Qté totale (${row.quantityUnit || "--"})`}>
                  <Input value={row.quantityTotal ? row.quantityTotal.toFixed(4) : ""} disabled />
                </FF>
                <Btn variant="ghost" onClick={() => setAdjuvants((prev: any[]) => prev.filter((_, idx) => idx !== row.index))} disabled={isSubmitting} style={{ color:T.red, padding:"0 8px" }}>x</Btn>
              </div>
              {row.product && (
                <div style={{ fontSize:11, color:row.stockShortage ? T.red : T.textDim, marginTop:8 }}>
                  Stock disponible: {row.stockAvailable.toFixed(2)} {row.product.unit}{row.stockShortage ? " - stock insuffisant" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
