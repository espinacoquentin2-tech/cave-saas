"use client";
import { useState, useRef } from "react";
import { calculateMixtionRecipe } from "@/lib/mixtion";
import type { PanelProps } from "./types";
import { snapshot } from "./types";
import { calculateBottleCount } from "@/lib/tirage";
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
  textValue,
  localNow,
  isoValue,
} from "./fields";
export function LevainMixtionPanel({ data, submit, busy }: PanelProps) {
  const [sugarSource, setSugarSource] = useState("SUCRE"),
    [mode, setMode] = useState("PREPARED");
  const [fields, setFields] = useState<FormData | null>(null);
  const form = useRef<HTMLFormElement>(null),
    [preview, setPreview] =
      useState<ReturnType<typeof calculateMixtionRecipe>>(null);
  const calculate = () => {
    if (!form.current) return;
    const f = new FormData(form.current);
    setFields(f);
    setPreview(
      calculateMixtionRecipe({
        baseVolumeHl: numberValue(f, "baseVolumeHl"),
        levainVolumeHl: numberValue(f, "levainVolumeHl"),
        baseSugarGPerL: numberValue(f, "baseSugarGPerL"),
        levainSugarGPerL: numberValue(f, "levainSugarGPerL"),
        targetSugarGPerL: numberValue(f, "targetSugarGPerL"),
        sugarSource: textValue(f, "sugarSource") as "SUCRE" | "LIQUEUR",
        liqueurSugarGPerL: numberValue(f, "liqueurSugarGPerL"),
      }),
    );
  };
  const forecast: ForecastDebits = { lots: [], products: [] };
  if (fields && preview) {
    const f = fields;
    forecast.lots.push(
      {
        id: numberValue(f, "sourceLotId"),
        quantity: numberValue(f, "baseVolumeHl"),
      },
      {
        id: numberValue(f, "levainLotId"),
        quantity: numberValue(f, "levainVolumeHl"),
      },
    );
    if (sugarSource === "SUCRE")
      forecast.products.push({
        id: numberValue(f, "sugarProductId"),
        quantity: preview.sugarKg,
        unit: "kg",
      });
    else
      addLiqueurForecast(
        forecast,
        liqueurInput(f),
        Number(preview.liqueurVolumeHl.toFixed(3)),
      );
    forecast.products.push({
      id: numberValue(f, "adjuvantProductId"),
      quantity: numberValue(f, "adjuvantKg"),
      unit: "kg",
    });
  }
  return (
    <section>
      <h3>Mixtion puis mise en bouteilles</h3>
      <p>
        Les vins, le levain et les intrants sont consommés à la préparation. Le
        tirage débite ensuite uniquement la mixtion et les emballages.
      </p>
      <form
        ref={form}
        onChange={calculate}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            lot = data.items.find(
              (l) => l.lotId === numberValue(f, "levainLotId"),
            );
          if (!lot) return;
          await submit("mixtion", {
            sourceLotId: numberValue(f, "sourceLotId"),
            baseVolumeHl: numberValue(f, "baseVolumeHl"),
            snapshot: snapshot(lot),
            levainVolumeHl: numberValue(f, "levainVolumeHl"),
            destinationContainerId: numberValue(f, "destinationContainerId"),
            baseSugarGPerL: numberValue(f, "baseSugarGPerL"),
            levainSugarGPerL: numberValue(f, "levainSugarGPerL"),
            targetSugarGPerL: numberValue(f, "targetSugarGPerL"),
            sugarSource,
            ...(sugarSource === "SUCRE"
              ? { sugarProductId: numberValue(f, "sugarProductId") }
              : { liqueur: liqueurInput(f) }),
            adjuvants: numberValue(f, "adjuvantProductId")
              ? [
                  {
                    productId: numberValue(f, "adjuvantProductId"),
                    quantity: numberValue(f, "adjuvantKg"),
                    unit: "kg",
                    kind: "OTHER",
                  },
                ]
              : [],
          });
        }}
      >
        <fieldset disabled={busy}>
          <div className="levain-grid">
            <WineSelect
              label="Vin de la mixtion"
              name="sourceLotId"
              wines={data.wines}
            />
            <Num label="Vin à mélanger (hL)" name="baseVolumeHl" value={2} />
            <Field label="Levain qualifié">
              <select name="levainLotId" required>
                <option value="">Choisir un levain prêt</option>
                {data.items
                  .filter((l) => l.state === "LEVAIN_PRET")
                  .map((l) => (
                    <option key={l.lotId} value={l.lotId}>
                      {l.name} — {l.volumeHl} hL
                    </option>
                  ))}
              </select>
            </Field>
            <Num
              label="Levain prélevé (hL)"
              name="levainVolumeHl"
              value={0.2}
            />
            <Field label="Cuve de mixtion">
              <select name="destinationContainerId" required>
                <option value="">Choisir une cuve vide</option>
                {data.emptyTanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.capacityHl} hL
                  </option>
                ))}
              </select>
            </Field>
            <Num
              label="Sucres du vin (g/L GF)"
              name="baseSugarGPerL"
              value={1}
            />
            <Num
              label="Sucres du levain (g/L GF)"
              name="levainSugarGPerL"
              value={20}
            />
            <Num
              label="Concentration cible (g/L GF)"
              name="targetSugarGPerL"
              value={25.4}
            />
            <Field label="Apport de sucre">
              <select
                name="sugarSource"
                value={sugarSource}
                onChange={(e) => setSugarSource(e.target.value)}
              >
                <option value="SUCRE">Sucre cristallisé</option>
                <option value="LIQUEUR">Liqueur</option>
              </select>
            </Field>
            {sugarSource === "SUCRE" ? (
              <ProductSelect
                label="Sucre de mixtion"
                name="sugarProductId"
                products={data.products}
                dimension="mass"
              />
            ) : (
              <LiqueurFields
                mode={mode}
                onMode={setMode}
                products={data.products}
                wines={data.wines}
              />
            )}
            <ProductSelect
              label="Adjuvant de mixtion"
              name="adjuvantProductId"
              products={data.products}
              dimension="mass"
              required={false}
            />
            <Num label="Adjuvant introduit (kg)" name="adjuvantKg" value={0} />
          </div>
          <p>
            La concentration cible est exprimée en glucose-fructose ; validez
            son point de tirage après homogénéisation.
          </p>
          {preview && (
            <p>
              Volume de mixtion : {preview.volumeHl.toFixed(3)} hL · saccharose
              : {preview.sugarKg.toFixed(3)} kg · liqueur :{" "}
              {preview.liqueurVolumeHl.toFixed(3)} hL.
            </p>
          )}
          <button type="button" onClick={calculate}>
            Calculer la mixtion
          </button>
          <StockForecast data={data} debits={forecast} />
          <button type="submit" disabled={!preview}>
            Enregistrer la mixtion
          </button>
        </fieldset>
      </form>
      {data.mixtions
        .filter((m) => m.volumeHl > 0)
        .map((m) => (
          <div key={m.lotId}>
            <h4>
              {m.name} — {m.volumeHl} hL
            </h4>
            {!m.checked ? (
              <form
                key="point-de-tirage"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await submit("check", {
                    lotId: m.lotId,
                    expectedVolumeHl: m.volumeHl,
                    lastMutationEventId:
                      m.compositionEventId ?? m.creationEventId,
                    performedAt: isoValue(f, "performedAt"),
                    wineDensity20: numberValue(f, "wineDensity20"),
                    mixtionDensity20: numberValue(f, "mixtionDensity20"),
                    operatorConfirmed: true,
                    comment: textValue(f, "comment"),
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <div className="levain-grid">
                    <Num
                      label="Masse volumique vin à 20 °C"
                      name="wineDensity20"
                      min={800}
                      max={1300}
                    />
                    <Num
                      label="Masse volumique mixtion à 20 °C"
                      name="mixtionDensity20"
                      min={800}
                      max={1300}
                    />
                    <Field label="Date du point de tirage">
                      <input
                        type="datetime-local"
                        name="performedAt"
                        defaultValue={localNow()}
                        required
                      />
                    </Field>
                    <Field label="Observations du point de tirage">
                      <textarea name="comment" />
                    </Field>
                    <label>
                      <input type="checkbox" required /> Je confirme le point de
                      tirage après homogénéisation.
                    </label>
                  </div>
                  <button type="submit">Enregistrer le point de tirage</button>
                </fieldset>
              </form>
            ) : (
              <form
                key={`mise-en-bouteilles-${m.volumeHl}`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    format = textValue(f, "format"),
                    count = calculateBottleCount(
                      numberValue(f, "volumeHl"),
                      format,
                    );
                  const stockItems = [
                    ["bottleProductId", "PACKAGING_BOTTLE"],
                    ["closureProductId", "PACKAGING_PRIMARY_CLOSURE"],
                    ["secondaryProductId", "PACKAGING_SECONDARY_CLOSURE"],
                  ].map(([name, kind]) => {
                    const p = data.products.find(
                      (p) => p.id === numberValue(f, name),
                    )!;
                    return {
                      productId: p.id,
                      kind,
                      quantity: count,
                      unit: p.unit,
                      label: p.name,
                    };
                  });
                  await submit("tirage", {
                    lotId: m.lotId,
                    sourceContainerId: m.containerId,
                    volume: numberValue(f, "volumeHl"),
                    format,
                    count,
                    bouchage: textValue(f, "bouchage"),
                    tirageDate: new Date().toISOString(),
                    isTranquille: false,
                    stockItems,
                    calculatedItems: [],
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <div className="levain-grid">
                    <Num
                      label="Volume à embouteiller (hL)"
                      name="volumeHl"
                      value={m.volumeHl}
                      max={m.volumeHl}
                    />
                    <Field label="Format de bouteille">
                      <select name="format">
                        <option value="75cl">75 cl</option>
                        <option value="37.5cl">37,5 cl</option>
                        <option value="150cl">150 cl</option>
                        <option value="300cl">300 cl</option>
                      </select>
                    </Field>
                    <Field label="Bouchage">
                      <select name="bouchage">
                        <option value="CAPSULE">Capsule et bidule</option>
                        <option value="LIEGE">Liège et agrafe</option>
                      </select>
                    </Field>
                    <ProductSelect
                      label="Bouteilles"
                      name="bottleProductId"
                      products={data.products.filter(
                        (p) => p.subCategory === "Bouteilles",
                      )}
                      dimension="packaging"
                    />
                    <ProductSelect
                      label="Fermeture principale"
                      name="closureProductId"
                      products={data.products.filter((p) =>
                        ["Capsules", "Bouchons"].includes(p.subCategory),
                      )}
                      dimension="packaging"
                    />
                    <ProductSelect
                      label="Fermeture secondaire"
                      name="secondaryProductId"
                      products={data.products.filter((p) =>
                        ["Bidules", "Agrafes"].includes(p.subCategory),
                      )}
                      dimension="packaging"
                    />
                  </div>
                  <button type="submit">
                    Enregistrer la mise en bouteilles
                  </button>
                </fieldset>
              </form>
            )}
          </div>
        ))}
    </section>
  );
}
