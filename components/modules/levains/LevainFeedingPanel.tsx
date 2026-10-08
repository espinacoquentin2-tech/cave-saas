"use client";
import { useState, useRef } from "react";
import { calculateLevainFeeding } from "@/lib/levain";
import { calculateLiqueurPreparation } from "@/lib/liqueur";
import type { LevainFeedingParameters } from "@/lib/levain-types";
import type { PanelProps } from "./types";
import { snapshot } from "./types";
import {
  StockForecast,
  addLiqueurForecast,
  type ForecastDebits,
} from "./StockForecast";
import {
  Field,
  Num,
  WineSelect,
  ProductSelect,
  LiqueurFields,
  liqueurInput,
  numberValue,
  isoValue,
  localNow,
} from "./fields";
const offsetDate = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
function parameters(
  form: FormData,
  remaining: number,
): LevainFeedingParameters {
  const q = liqueurInput(form),
    alcohol =
      q.mode === "PREPARED"
        ? q.alcoholPct
        : (calculateLiqueurPreparation(
            1,
            q.sugarGfPerL,
            q.dissolutionWineAlcoholPct,
          )?.alcoholPct ?? 0);
  return {
    remainingVolumeHl: remaining,
    finalVolumeHl: numberValue(form, "finalVolumeHl"),
    previousDensity: numberValue(form, "previousDensity"),
    currentDensity: numberValue(form, "currentDensity"),
    liqueurSugarGPerL: q.sugarGfPerL,
    wineAlcoholPct: numberValue(form, "wineAlcoholPct"),
    remainingSugarGPerL: numberValue(form, "remainingSugarGPerL"),
    levainAlcoholPct: numberValue(form, "levainAlcoholPct"),
    targetAlcoholPct: numberValue(form, "targetAlcoholPct"),
    liqueurAlcoholPct: alcohol,
    previousMeasuredAt: isoValue(form, "previousMeasuredAt"),
    currentMeasuredAt: isoValue(form, "currentMeasuredAt"),
    nextWithdrawalAt: isoValue(form, "nextWithdrawalAt"),
  };
}
export function LevainFeedingPanel({ data, submit, busy }: PanelProps) {
  const [id, setId] = useState(""),
    [mode, setMode] = useState("PREPARED"),
    [fields, setFields] = useState<FormData | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const lot =
    data.items.find((l) => String(l.lotId) === id) ??
    data.items.find((l) =>
      ["LEVAIN_PRET", "LEVAIN_EN_PROPAGATION"].includes(l.state ?? ""),
    );
  const [preview, setPreview] =
    useState<ReturnType<typeof calculateLevainFeeding>>(null);
  const [fabrication, setFabrication] =
    useState<ReturnType<typeof calculateLiqueurPreparation>>(null);
  const update = () => {
    if (!form.current || !lot) return;
    try {
      const f = new FormData(form.current),
        p = parameters(f, lot.volumeHl),
        r = calculateLevainFeeding(p);
      setFields(f);
      setPreview(r);
      const q = liqueurInput(f);
      setFabrication(
        r && q.mode === "MAKE"
          ? calculateLiqueurPreparation(
              r.liqueurVolumeHl,
              q.sugarGfPerL,
              q.dissolutionWineAlcoholPct,
            )
          : null,
      );
    } catch {
      setPreview(null);
    }
  };
  const forecast: ForecastDebits = { lots: [], products: [] };
  if (fields && preview) {
    const f = fields,
      source = data.wines.find(
        (l) => l.containerId === numberValue(f, "sourceContainerId"),
      );
    if (source)
      forecast.lots.push({ id: source.lotId, quantity: preview.wineVolumeHl });
    forecast.products.push({
      id: numberValue(f, "dapProductId"),
      quantity: preview.dapKg,
      unit: "kg",
    });
    addLiqueurForecast(forecast, liqueurInput(f), preview.liqueurVolumeHl);
  }
  if (!lot) return <p>Qualifiez un levain avant son premier nourrissage.</p>;
  return (
    <section>
      <h3>Nourrissage du volume restant</h3>
      <Field label="Cuve à levain">
        <select
          value={lot.lotId}
          onChange={(e) => {
            setId(e.target.value);
            setPreview(null);
          }}
        >
          {data.items
            .filter((l) =>
              ["LEVAIN_PRET", "LEVAIN_EN_PROPAGATION"].includes(l.state ?? ""),
            )
            .map((l) => (
              <option key={l.lotId} value={l.lotId}>
                {l.name} — {l.volumeHl} hL
              </option>
            ))}
        </select>
      </Field>
      <p>
        Volume réel restant : {lot.volumeHl} hL. Après nourrissage, une nouvelle
        qualification est nécessaire avant prélèvement.
      </p>
      <form
        key={lot.lotId}
        ref={form}
        onChange={update}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await submit("feed", {
            ...parameters(f, lot.volumeHl),
            sourceContainerId: numberValue(f, "sourceContainerId"),
            levainContainerId: lot.containerId,
            snapshot: snapshot(lot),
            liqueur: liqueurInput(f),
            dapProductId: numberValue(f, "dapProductId"),
          });
        }}
      >
        <fieldset disabled={busy}>
          <div className="levain-grid">
            <WineSelect
              label="Vin nourricier"
              name="sourceContainerId"
              wines={data.wines}
              container
            />
            <Num
              label="Volume visé (hL)"
              name="finalVolumeHl"
              value={lot.volumeHl + 2}
              min={lot.volumeHl + 0.001}
            />
            <Num
              label="Masse volumique veille à 20 °C"
              name="previousDensity"
              value={1000}
              min={800}
              max={1300}
            />
            <Num
              label="Masse volumique matin à 20 °C"
              name="currentDensity"
              value={1000}
              min={800}
              max={1300}
            />
            <Field label="Date mesure veille">
              <input
                name="previousMeasuredAt"
                type="datetime-local"
                defaultValue={offsetDate(-24)}
                required
              />
            </Field>
            <Field label="Date mesure matin">
              <input
                name="currentMeasuredAt"
                type="datetime-local"
                defaultValue={localNow()}
                required
              />
            </Field>
            <Field label="Prochain prélèvement">
              <input
                name="nextWithdrawalAt"
                type="datetime-local"
                defaultValue={offsetDate(24)}
                required
              />
            </Field>
            <Num
              label="Sucres résiduels du levain (g/L GF)"
              name="remainingSugarGPerL"
              value={20}
              max={1000}
            />
            <Num
              label="TAV levain (%)"
              name="levainAlcoholPct"
              value={12}
              max={20}
            />
            <Num
              label="TAV cible du lendemain (%)"
              name="targetAlcoholPct"
              value={12}
              max={20}
            />
            <Num
              label="TAV vin nourricier (%)"
              name="wineAlcoholPct"
              value={13}
              min={0.1}
              max={20}
            />
            <LiqueurFields
              mode={mode}
              onMode={(m) => {
                setMode(m);
                setPreview(null);
              }}
              wines={data.wines}
              products={data.products}
            />
            <ProductSelect
              label="Produit DAP"
              name="dapProductId"
              products={data.products}
              dimension="mass"
            />
          </div>
          <p>
            DAP : 20 g/hL du volume total visé. Sélectionnez un phosphate
            biammonique ; un autre nutriment n’est pas équivalent.
          </p>
          <p>
            La consommation prévue est une projection à vitesse constante à
            partir des mesures corrigées à 20 °C.
          </p>
          {preview ? (
            <>
              <p>
                Recette : vin direct {preview.wineVolumeHl} hL · liqueur{" "}
                {preview.liqueurVolumeHl} hL · eau {preview.waterVolumeHl} hL ·
                DAP {preview.dapKg} kg.
              </p>
              {fabrication && (
                <p>
                  Fabrication de liqueur : {fabrication.sugarKg.toFixed(3)} kg
                  de saccharose +{" "}
                  {fabrication.dissolutionWineVolumeHl.toFixed(3)} hL de vin de
                  dissolution.
                </p>
              )}
              <StockForecast data={data} debits={forecast} />
              <p>
                Sucre observé : {preview.consumedSugarGPerL.toFixed(2)} g/L ;
                prévu : {preview.projectedConsumedSugarGPerL.toFixed(2)} g/L.
              </p>
            </>
          ) : (
            <p>Complétez ou ajustez les paramètres pour calculer la recette.</p>
          )}
          <button type="button" onClick={update}>
            Calculer la recette
          </button>
          <button type="submit" disabled={!preview}>
            Valider le nourrissage
          </button>
        </fieldset>
      </form>
    </section>
  );
}
