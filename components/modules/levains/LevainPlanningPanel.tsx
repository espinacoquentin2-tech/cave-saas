"use client";
import { useState } from "react";
import { calculateLevainPlanning } from "@/lib/levain-planning";
import type { PlannedTirageDay } from "@/lib/levain-types";
import { Field } from "./fields";
export function LevainPlanningPanel({
  onPlan,
}: {
  onPlan: (plan: unknown) => void;
}) {
  const [days, setDays] = useState<PlannedTirageDay[]>([
      { date: new Date().toISOString().slice(0, 10), baseWineVolumeHl: 100 },
    ]),
    [pct, setPct] = useState(3),
    [temp, setTemp] = useState<13 | 16 | 20>(16);
  let rows: ReturnType<typeof calculateLevainPlanning> = [],
    error = "";
  try {
    rows = calculateLevainPlanning(days, pct, temp);
  } catch (e) {
    error = e instanceof Error ? e.message : "Planning invalide.";
  }
  return (
    <section>
      <h3>Planning de campagne</h3>
      <p>
        Prévision des besoins, sans sortie de stock. Incluez la semaine suivante
        pour conserver une mère après le week-end.
      </p>
      <div className="levain-grid">
        <Field label="Levain prévu (%)">
          <input
            type="number"
            min="0.1"
            max="100"
            step="any"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
          />
        </Field>
        <Field label="Température de propagation">
          <select
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value) as 13 | 16 | 20)}
          >
            {[13, 16, 20].map((t) => (
              <option key={t} value={t}>
                {t} °C
              </option>
            ))}
          </select>
        </Field>
      </div>
      {days.map((day, i) => (
        <div className="levain-grid" key={i}>
          <Field label={`Date du tirage ${i + 1}`}>
            <input
              type="date"
              value={day.date}
              onChange={(e) =>
                setDays(
                  days.map((d, j) =>
                    j === i ? { ...d, date: e.target.value } : d,
                  ),
                )
              }
            />
          </Field>
          <Field label={`Vin prévu ${i + 1} (hL)`}>
            <input
              type="number"
              min="0"
              step="any"
              value={day.baseWineVolumeHl}
              onChange={(e) =>
                setDays(
                  days.map((d, j) =>
                    j === i
                      ? { ...d, baseWineVolumeHl: Number(e.target.value) }
                      : d,
                  ),
                )
              }
            />
          </Field>
          <button
            type="button"
            onClick={() => setDays(days.filter((_, j) => j !== i))}
          >
            Retirer cette journée
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const date = new Date(
            `${days.at(-1)?.date ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`,
          );
          date.setUTCDate(date.getUTCDate() + 1);
          setDays([
            ...days,
            { date: date.toISOString().slice(0, 10), baseWineVolumeHl: 100 },
          ]);
        }}
      >
        Ajouter une journée
      </button>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <p>
            Besoin maximal :{" "}
            {Math.max(0, ...rows.map((r) => r.morningVolumeHl))} hL. Préparation
            initiale : repère documentaire de trois jours, à adapter au
            protocole retenu.
          </p>
          <div className="levain-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Besoin tirage (hL)</th>
                  <th>Levain matin (hL)</th>
                  <th>Reste (hL)</th>
                  <th>Apport (hL)</th>
                  <th>Intervalle (j)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{r.requiredLevainVolumeHl}</td>
                    <td>{r.morningVolumeHl}</td>
                    <td>{r.remainingVolumeHl}</td>
                    <td>{r.feedingVolumeHl}</td>
                    <td>{r.intervalDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              onPlan({ days, levainPct: pct, temperatureC: temp, rows })
            }
          >
            Utiliser cette prévision pour la préparation
          </button>
        </>
      )}
    </section>
  );
}
