"use client";
import { useState } from "react";
import {
  StockForecast,
  addLiqueurForecast,
  type ForecastDebits,
} from "./StockForecast";
import type { PanelProps } from "./types";
import { snapshot } from "./types";
import {
  Field,
  Num,
  WineSelect,
  ProductSelect,
  textValue,
  numberValue,
  LiqueurFields,
  liqueurInput,
  localNow,
  isoValue,
} from "./fields";
export function LevainPreparationPanel({
  data,
  submit,
  busy,
  plan,
}: PanelProps) {
  const [target, setTarget] = useState(""),
    [liqueur, setLiqueur] = useState(false),
    [mode, setMode] = useState("PREPARED");
  const existing = data.items.find((l) => String(l.lotId) === target);
  const [fields, setFields] = useState<FormData | null>(null);
  const forecast: ForecastDebits = { lots: [], products: [] };
  if (fields) {
    const f = fields,
      source = data.wines.find(
        (l) => l.containerId === numberValue(f, "sourceContainerId"),
      );
    if (source)
      forecast.lots.push({
        id: source.lotId,
        quantity: numberValue(f, "volumeHl"),
      });
    forecast.products.push(
      {
        id: numberValue(f, "lsaProductId"),
        quantity: numberValue(f, "lsaKg"),
        unit: "kg",
      },
      {
        id: numberValue(f, "drySugarProductId"),
        quantity: numberValue(f, "drySugarKg"),
        unit: "kg",
      },
    );
    if (liqueur)
      addLiqueurForecast(
        forecast,
        liqueurInput(f),
        numberValue(f, "liqueurVolumeHl"),
      );
  }
  return (
    <section>
      <h3>Préparation initiale et étapes</h3>
      <p>
        Saisissez le protocole retenu et les apports réellement introduits. La
        création du milieu ne déclare pas le levain prêt au tirage.
      </p>
      <form
        onChange={(e) => setFields(new FormData(e.currentTarget))}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            p = numberValue(f, "lsaProductId"),
            s = numberValue(f, "drySugarProductId");
          const products = [
            ...(p
              ? [
                  {
                    productId: p,
                    quantity: numberValue(f, "lsaKg"),
                    unit: "kg",
                    kind: "LSA",
                  },
                ]
              : []),
            ...(s
              ? [
                  {
                    productId: s,
                    quantity: numberValue(f, "drySugarKg"),
                    unit: "kg",
                    kind: "SUGAR",
                  },
                ]
              : []),
          ];
          const recipe = {
            ...(numberValue(f, "sourceContainerId")
              ? { sourceContainerId: numberValue(f, "sourceContainerId") }
              : {}),
            volumeHl: numberValue(f, "volumeHl"),
            waterVolumeHl: numberValue(f, "waterVolumeHl"),
            products,
            step: {
              label: textValue(f, "stepLabel"),
              performedAt: isoValue(f, "performedAt"),
            },
            ...(liqueur
              ? {
                  liqueur: {
                    selection: liqueurInput(f),
                    volumeHl: numberValue(f, "liqueurVolumeHl"),
                  },
                }
              : {}),
          };
          if (existing)
            await submit("prepare", {
              ...recipe,
              snapshot: snapshot(existing),
            });
          else
            await submit("create", {
              ...recipe,
              protocol: {
                reference: textValue(f, "reference"),
                text: textValue(f, "protocol"),
              },
              ...(numberValue(f, "destinationContainerId")
                ? {
                    destinationContainerId: numberValue(
                      f,
                      "destinationContainerId",
                    ),
                  }
                : { capacityHl: numberValue(f, "capacityHl") }),
              ...(plan ? { plan } : {}),
            });
        }}
      >
        <fieldset disabled={busy}>
          <div className="levain-grid">
            <Field label="Préparation à enregistrer">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Nouveau levain</option>
                {data.items
                  .filter((l) => l.state === "LEVAIN_EN_PREPARATION")
                  .map((l) => (
                    <option key={l.lotId} value={l.lotId}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </Field>
            <WineSelect
              label="Vin source du levain"
              name="sourceContainerId"
              wines={data.wines}
              container
              required={!existing}
            />
            <Num
              label="Vin introduit (hL)"
              name="volumeHl"
              value={2}
              min={existing ? 0 : 0.001}
            />
            <Num label="Eau introduite (hL)" name="waterVolumeHl" value={0} />
            {!existing && (
              <>
                <Field label="Cuve de préparation">
                  <select name="destinationContainerId">
                    <option value="">Créer une nouvelle cuve</option>
                    {data.emptyTanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.capacityHl} hL
                      </option>
                    ))}
                  </select>
                </Field>
                <Num
                  label="Capacité nouvelle cuve (hL)"
                  name="capacityHl"
                  value={5}
                />
                <Field label="Référence du protocole">
                  <input name="reference" required />
                </Field>
                <Field label="Protocole retenu">
                  <textarea name="protocol" required />
                </Field>
              </>
            )}
            <Field label="Étape réalisée">
              <input name="stepLabel" required />
            </Field>
            <Field label="Date de l’étape">
              <input
                name="performedAt"
                type="datetime-local"
                defaultValue={localNow()}
                required
              />
            </Field>
            <ProductSelect
              label="Produit LSA"
              name="lsaProductId"
              dimension="mass"
              products={data.products}
              required={false}
            />
            <Num label="LSA introduites (kg)" name="lsaKg" value={0} />
            <ProductSelect
              label="Sucre sec de préparation"
              name="drySugarProductId"
              dimension="mass"
              products={data.products}
              required={false}
            />
            <Num label="Sucre sec introduit (kg)" name="drySugarKg" value={0} />
            <label>
              <input
                type="checkbox"
                checked={liqueur}
                onChange={(e) => setLiqueur(e.target.checked)}
              />{" "}
              Apporter une liqueur
            </label>
            {liqueur && (
              <>
                <LiqueurFields
                  mode={mode}
                  onMode={setMode}
                  wines={data.wines}
                  products={data.products}
                />
                <Num
                  label="Liqueur introduite (hL)"
                  name="liqueurVolumeHl"
                  value={0.1}
                />
              </>
            )}
          </div>
          <StockForecast data={data} debits={forecast} />
          <button type="submit">Enregistrer la préparation</button>
        </fieldset>
      </form>
    </section>
  );
}
