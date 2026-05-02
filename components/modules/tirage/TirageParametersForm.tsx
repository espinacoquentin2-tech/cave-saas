"use client";
// @ts-nocheck

import React from "react";
import { FF, Input, Select } from "@/components/ui";
import { useTheme } from "@/lib/store";
import { toSafeNumber } from "@/lib/client-app-helpers";

export function TirageParametersForm({
  form,
  setForm,
  isSubmitting,
  sugarProducts,
  yeastProducts,
  adjuvantProducts,
  planningSugarCalculation,
  planningSugarProduct,
  planningYeastQuantity,
  planningYeastProduct,
  planningAdjuvantQuantity,
  planningAdjuvantProduct,
  planningLevainVolumeHl,
  planningLevainPct,
  levainStockProduct,
}: any) {
  const T = useTheme();

  return (
    <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:16, display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:1, color:T.textDim, fontWeight:"bold" }}>Intrants calculés et confirmés</div>

      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 140px", gap:12, alignItems:"center" }}>
        <input type="checkbox" checked={form.includeSugar} disabled={isSubmitting} onChange={(e) => setForm((prev: any) => ({ ...prev, includeSugar: e.target.checked }))} />
        <Select value={form.sugarProductId} disabled={isSubmitting || !form.includeSugar} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, sugarProductId: e.target.value }))}>
          <option value="">-- Sucre de tirage --</option>
          {sugarProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({toSafeNumber(product.currentStock).toFixed(3)} {product.unit})</option>)}
        </Select>
        <Input value={planningSugarCalculation ? `${planningSugarCalculation.quantityTotal.toFixed(3)} ${planningSugarProduct?.unit || ""}` : "--"} disabled={true} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"auto 1.2fr 110px 110px 120px", gap:12, alignItems:"center" }}>
        <input type="checkbox" checked={form.includeYeast} disabled={isSubmitting} onChange={(e) => setForm((prev: any) => ({ ...prev, includeYeast: e.target.checked }))} />
        <Select value={form.yeastProductId} disabled={isSubmitting || !form.includeYeast} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, yeastProductId: e.target.value }))}>
          <option value="">-- Levure prise de mousse --</option>
          {yeastProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({toSafeNumber(product.currentStock).toFixed(3)} {product.unit})</option>)}
        </Select>
        <Input type="number" step="0.1" value={form.yeastDose} disabled={isSubmitting || !form.includeYeast} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, yeastDose: e.target.value }))} />
        <Select value={form.yeastDoseUnit} disabled={isSubmitting || !form.includeYeast} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, yeastDoseUnit: e.target.value }))}>
          {["g/hL", "kg/hL", "mL/hL", "L/hL"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </Select>
        <Input value={form.includeYeast && planningYeastQuantity > 0 ? `${planningYeastQuantity.toFixed(3)} ${planningYeastProduct?.unit || ""}` : "--"} disabled={true} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"auto 1.2fr 110px 110px 120px", gap:12, alignItems:"center" }}>
        <input type="checkbox" checked={form.includeAdjuvant} disabled={isSubmitting} onChange={(e) => setForm((prev: any) => ({ ...prev, includeAdjuvant: e.target.checked }))} />
        <Select value={form.adjuvantProductId} disabled={isSubmitting || !form.includeAdjuvant} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, adjuvantProductId: e.target.value }))}>
          <option value="">-- Adjuvant de remuage --</option>
          {adjuvantProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({toSafeNumber(product.currentStock).toFixed(3)} {product.unit})</option>)}
        </Select>
        <Input type="number" step="0.1" value={form.adjuvantDose} disabled={isSubmitting || !form.includeAdjuvant} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, adjuvantDose: e.target.value }))} />
        <Select value={form.adjuvantDoseUnit} disabled={isSubmitting || !form.includeAdjuvant} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, adjuvantDoseUnit: e.target.value }))}>
          {["mL/hL", "L/hL", "g/hL", "kg/hL"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </Select>
        <Input value={form.includeAdjuvant && planningAdjuvantQuantity > 0 ? `${planningAdjuvantQuantity.toFixed(3)} ${planningAdjuvantProduct?.unit || ""}` : "--"} disabled={true} />
      </div>

      <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>
        Levain calculé: <strong>{planningLevainVolumeHl.toFixed(3)} hL</strong> à {planningLevainPct.toFixed(1)} %.
        {levainStockProduct
          ? " Produit levain détecté mais non consommé automatiquement: TODO métier explicite à confirmer."
          : " Aucun produit stock dédié n'est présent dans le seed: levain traité comme donnée de process non stockée."}
      </div>
    </div>
  );
}
