"use client";
import { useState } from "react";
import { Select } from "@/components/ui";
import type { MaloLotView } from "@/lib/malo-types";
import { Field, volume } from "./fields";
export function MaloSourceSelector({
  sources,
  value,
  onChange,
}: {
  sources: MaloLotView[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [taille, setTaille] = useState(false);
  const rows = sources.filter((l) => !taille || l.origin === "Taille");
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={taille}
          onChange={(e) => setTaille(e.target.checked)}
        />{" "}
        Afficher les tailles
      </label>
      <Field label="Lot source">
        <Select
          aria-label="Lot source"
          value={value || ""}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange(Number(e.target.value))
          }
        >
          <option value="">Choisir un lot disponible</option>
          {rows.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · {l.year ?? ""} · {l.containerName} · {l.origin} ·{" "}
              {volume(l.volumeHl)}
            </option>
          ))}
        </Select>
      </Field>
      <div style={{ overflowX: "auto", maxHeight: 230 }}>
        <table style={{ width: "100%", fontSize: 12, textAlign: "left" }}>
          <thead>
            <tr>
              {[
                "Lot / cuve",
                "Origine / état",
                "Disponible",
                "Prélèvement",
                "pH",
                "SO₂ libre / total",
                "Malique",
                "TAV",
                "Temp. / densité",
                "Sucres",
              ].map((s) => (
                <th key={s} style={{ padding: 6 }}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const a = l.analyses[0],
                x = a?.extraData;
              const show = (v: unknown) =>
                v == null ? "Non renseigné" : String(v);
              return (
                <tr
                  key={l.id}
                  style={{ background: l.id === value ? "#8882" : undefined }}
                >
                  <td style={{ padding: 6 }}>
                    {l.name} · {l.year ?? "Millésime non renseigné"}
                    <br />
                    {l.containerName}
                  </td>
                  <td>
                    {l.origin}
                    <br />
                    {l.status.replaceAll("_", " ")}
                  </td>
                  <td>{volume(l.volumeHl)}</td>
                  <td>
                    {a
                      ? new Date(a.analysisDate).toLocaleDateString("fr-FR")
                      : "Analyse manquante"}
                  </td>
                  <td>{show(a?.ph)}</td>
                  <td>
                    {show(a?.so2Free)} / {show(a?.so2Total)} mg/L
                  </td>
                  <td>{show(x?.malique)} g/L</td>
                  <td>{show(a?.alcohol)} % vol</td>
                  <td>
                    {show(x?.temperatureC)} °C /{" "}
                    {show(x?.density20 ?? x?.density)} g/L
                  </td>
                  <td>{show(x?.sucresResiduel)} g/L</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
