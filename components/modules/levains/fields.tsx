"use client";
import { useId, isValidElement, cloneElement, type ReactNode } from "react";
import type { LotView, ProductView } from "./types";
export const numberValue = (form: FormData, name: string) =>
  Number(form.get(name) || 0);
export const textValue = (form: FormData, name: string) =>
  String(form.get(name) || "");
export const isoValue = (form: FormData, name: string) =>
  new Date(textValue(form, name)).toISOString();
export const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="levain-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
    </div>
  );
}
export function Num({
  label,
  name,
  value,
  required = true,
  min = 0,
  max,
  step = "any",
}: {
  label: string;
  name: string;
  value?: number;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <Field label={label}>
      <input
        aria-label={label}
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        required={required}
      />
    </Field>
  );
}
export function WineSelect({
  label,
  name,
  wines,
  container = false,
  required = true,
}: {
  label: string;
  name: string;
  wines: LotView[];
  container?: boolean;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <select name={name} aria-label={label} required={required}>
        <option value="">Choisir un vin</option>
        {wines.map((w) => (
          <option
            key={w.lotId}
            value={container ? (w.containerId ?? "") : w.lotId}
          >
            {w.containerName || w.name} — {w.volumeHl} hL
          </option>
        ))}
      </select>
    </Field>
  );
}
export function ProductSelect({
  label,
  name,
  products,
  dimension,
  required = true,
}: {
  label: string;
  name: string;
  products: ProductView[];
  dimension: "mass" | "volume" | "packaging";
  required?: boolean;
}) {
  const units =
    dimension === "mass"
      ? ["g", "kg"]
      : dimension === "volume"
        ? ["l", "hl"]
        : ["btl", "unites", "unités"];
  return (
    <Field label={label}>
      <select aria-label={label} name={name} required={required}>
        <option value="">Choisir un produit</option>
        {products
          .filter(
            (p) =>
              units.includes(p.unit.toLowerCase()) &&
              (dimension === "packaging" ||
                p.category.toLowerCase() === "intrants"),
          )
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.currentStock} {p.unit}
            </option>
          ))}
      </select>
    </Field>
  );
}
export function LiqueurFields({
  mode,
  wines,
  products,
  onMode,
}: {
  mode: string;
  wines: LotView[];
  products: ProductView[];
  onMode: (mode: string) => void;
}) {
  return (
    <>
      <Field label="Mode de liqueur">
        <select
          aria-label="Mode de liqueur"
          name="liqueurMode"
          value={mode}
          onChange={(e) => onMode(e.target.value)}
        >
          <option value="PREPARED">Liqueur préparée en stock</option>
          <option value="MAKE">Préparer avec du sucre et du vin</option>
        </select>
      </Field>
      {mode === "PREPARED" ? (
        <>
          <ProductSelect
            label="Produit liqueur"
            name="liqueurProductId"
            products={products}
            dimension="volume"
          />
          <Num
            label="TAV liqueur (%)"
            name="liqueurAlcoholPct"
            value={7.5}
            max={20}
          />
        </>
      ) : (
        <>
          <ProductSelect
            label="Produit sucre"
            name="sugarProductId"
            products={products}
            dimension="mass"
          />
          <WineSelect
            label="Vin de dissolution"
            name="dissolutionLotId"
            wines={wines}
          />
          <Num
            label="TAV vin de dissolution (%)"
            name="dissolutionWineAlcoholPct"
            value={11}
            min={0.1}
            max={20}
          />
        </>
      )}
      <Num
        label="Titre liqueur en glucose-fructose (g/L)"
        name="liqueurSugarGPerL"
        value={530}
        min={0.1}
        max={1000}
      />
    </>
  );
}
export function liqueurInput(form: FormData) {
  const sugarGfPerL = numberValue(form, "liqueurSugarGPerL");
  return textValue(form, "liqueurMode") === "MAKE"
    ? {
        mode: "MAKE" as const,
        sugarProductId: numberValue(form, "sugarProductId"),
        dissolutionLotId: numberValue(form, "dissolutionLotId"),
        sugarGfPerL,
        dissolutionWineAlcoholPct: numberValue(
          form,
          "dissolutionWineAlcoholPct",
        ),
      }
    : {
        mode: "PREPARED" as const,
        productId: numberValue(form, "liqueurProductId"),
        sugarGfPerL,
        alcoholPct: numberValue(form, "liqueurAlcoholPct"),
      };
}
export function Measurements() {
  return (
    <>
      <Num
        label="Température mesurée (°C)"
        name="temperatureC"
        required={false}
        min={-5}
        max={45}
      />
      <Num
        label="Masse volumique corrigée à 20 °C"
        name="density20"
        required={false}
        min={800}
        max={1300}
      />
      <Num label="TAV mesuré (%)" name="alcoholPct" required={false} max={20} />
      <Num
        label="Sucres résiduels mesurés (g/L GF)"
        name="residualSugarGPerL"
        required={false}
        max={1000}
      />
      <Num label="pH mesuré" name="ph" required={false} max={14} />
      <Num
        label="Population (millions de cellules/mL)"
        name="populationMillionsPerMl"
        required={false}
      />
    </>
  );
}
export const readMeasurements = (form: FormData) =>
  Object.fromEntries(
    [
      "temperatureC",
      "density20",
      "alcoholPct",
      "residualSugarGPerL",
      "ph",
      "populationMillionsPerMl",
    ].map((name) => [
      name,
      textValue(form, name) === "" ? null : numberValue(form, name),
    ]),
  );
