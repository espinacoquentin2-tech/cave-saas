"use client";
// @ts-nocheck

import React from "react";
import { FF, Input, Select } from "@/components/ui";
import { useTheme } from "@/lib/store";
import { getLotCode } from "@/lib/client-app-helpers";
import { getBottleFormatLabel } from "@/lib/assemblage";

export function TirageSourceSelector({
  form,
  setForm,
  isSubmitting,
  cuvesVinBase,
  getContainerLot,
  analyses,
  planningSourceLotCode,
  planningSourceLot,
  planningAvailableVolumeHl,
  planningAnalysisResidualSugar,
}: any) {
  const T = useTheme();

  return (
    <>
      <div>
        <div style={{ fontSize:14, fontWeight:"bold", color:T.textStrong, marginBottom:4 }}>Créer le tirage depuis cette planification</div>
        <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>
          Cette préparation appelle <code>/api/tirage</code> avec les mêmes règles d'éligibilité, de volume et de stock que le tirage direct.
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <FF label="Cuve source">
          <Select
            value={form.sourceContainerId}
            disabled={isSubmitting}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const nextContainerId = e.target.value;
              const nextContainer = cuvesVinBase.find((container: any) => String(container.id) === String(nextContainerId));
              const nextLot = nextContainer ? getContainerLot(nextContainer) : null;
              const nextAnalyses = nextLot
                ? (analyses || [])
                    .filter((analysis: any) => String(analysis.lotId) === String(nextLot.id))
                    .sort((a: any, b: any) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime())
                : [];
              const nextResidualSugar = nextAnalyses[0]?.extraData?.sucresResiduel;
              setForm((prev: any) => ({
                ...prev,
                sourceContainerId: nextContainerId,
                residualSugarGPerL:
                  nextResidualSugar != null && prev.residualSugarGPerL === ""
                    ? String(nextResidualSugar)
                    : prev.residualSugarGPerL,
              }));
            }}
          >
            <option value="">-- Sélectionner une cuve source --</option>
            {cuvesVinBase.map((container: any) => {
              const lot = getContainerLot(container);
              return (
                <option key={container.id} value={container.id}>
                  {(container.displayName || container.name)} · {lot ? getLotCode(lot) : "Lot introuvable"} · {parseFloat(container.currentVolume || lot?.currentVolume || 0).toFixed(1)} hL
                </option>
              );
            })}
          </Select>
        </FF>
        <FF label="Lot source détecté">
          <Input value={planningSourceLotCode || "--"} disabled={true} />
        </FF>
        <FF label="Volume à tirer (hL)">
          <Input type="number" step="0.1" value={form.requestedVolumeHl} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, requestedVolumeHl: e.target.value }))} />
        </FF>
        <FF label="Volume disponible">
          <Input value={planningSourceLot ? `${planningAvailableVolumeHl.toFixed(3)} hL` : "--"} disabled={true} />
        </FF>
        <FF label="Format bouteille">
          <Select value={form.format} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, format: e.target.value }))}>
            {["37.5cl", "75cl", "150cl", "300cl"].map((format) => (
              <option key={format} value={format}>{getBottleFormatLabel(format)}</option>
            ))}
          </Select>
        </FF>
        <FF label="Type de bouchage">
          <Select value={form.bouchage} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: any) => ({ ...prev, bouchage: e.target.value }))}>
            <option value="CAPSULE">Capsule + Bidule</option>
            <option value="LIEGE">Liège + Agrafe</option>
          </Select>
        </FF>
        <FF label="Pression cible (bar)">
          <Input type="number" step="0.1" value={form.pressureTargetBars} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, pressureTargetBars: e.target.value }))} />
        </FF>
        <FF label="Température vin (°C)">
          <Input type="number" step="0.1" value={form.wineTemperatureC} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, wineTemperatureC: e.target.value }))} placeholder="Optionnel" />
        </FF>
        <FF label="Sucres résiduels (g/L)">
          <Input type="number" step="0.1" value={form.residualSugarGPerL} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, residualSugarGPerL: e.target.value }))} placeholder={planningAnalysisResidualSugar != null ? `Analyse: ${planningAnalysisResidualSugar} g/L` : "Optionnel"} />
        </FF>
        <FF label="Note opérateur">
          <Input value={form.note} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: any) => ({ ...prev, note: e.target.value }))} placeholder="Ex: tirage préparé depuis le planning hebdo" />
        </FF>
      </div>
    </>
  );
}
