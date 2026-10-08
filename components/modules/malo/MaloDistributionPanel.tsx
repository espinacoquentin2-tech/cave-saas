"use client";
import { useState } from "react";
import { Btn, Input, Select } from "@/components/ui";
import type { MaloDossierView, MaloWorkspace } from "@/lib/malo-types";
import { calculateMaloDose, maloControlLabel } from "@/lib/malo";
import {
  MaloSection,
  Field,
  grid,
  volume,
  localTime,
  type Submit,
} from "./fields";
export function MaloDistributionPanel({
  dossier,
  data,
  submit,
}: {
  dossier: MaloDossierView;
  data: MaloWorkspace;
  submit: Submit;
}) {
  const [direction, setDirection] = useState("MR_TO_PCM"),
    [transferVolume, setTransferVolume] = useState(0),
    [selected, setSelected] = useState<
      Record<number, { pct: number; volumeHl: number }>
    >(() =>
      Object.fromEntries(
        dossier.plannedDestinations.map((d) => {
          const l = data.targets.find((l) => l.id === d.lotId);
          return [
            d.lotId,
            {
              pct: d.dosePct,
              volumeHl: l ? calculateMaloDose(l.volumeHl, d.dosePct) : 0,
            },
          ];
        }),
      ),
    ),
    [date, setDate] = useState(localTime),
    [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState("");
  const mr = dossier.lots.find((l) => l.role === "MR"),
    pcm = dossier.lots.find((l) => l.role === "PCM");
  const source = direction === "MR_TO_PCM" ? mr : pcm,
    target = direction === "MR_TO_PCM" ? pcm : mr;
  const total = Object.values(selected).reduce((n, v) => n + v.volumeHl, 0);
  const additionsByContainer = new Map<number, number>();
  for (const lot of data.targets) {
    if (lot.containerId && selected[lot.id])
      additionsByContainer.set(
        lot.containerId,
        (additionsByContainer.get(lot.containerId) ?? 0) +
          selected[lot.id].volumeHl,
      );
  }
  const capacityError = data.targets.some(
    (l) =>
      l.containerId &&
      (l.occupiedVolumeHl ?? l.volumeHl) +
        (additionsByContainer.get(l.containerId) ?? 0) >
        l.capacityHl,
  );
  const stale = Object.keys(selected).some(
    (id) => !data.targets.some((l) => l.id === Number(id)),
  );
  const ready =
    pcm?.control?.criterionReached &&
    pcm.control.initial &&
    pcm.control.current;
  const targets = Object.entries(selected)
    .map(([id, v]) => {
      const l = data.targets.find((l) => l.id === Number(id));
      return l
        ? { lotId: l.id, snapshot: l.snapshot, volumeHl: v.volumeHl }
        : null;
    })
    .filter((d): d is NonNullable<typeof d> => !!d);
  const transfer = () =>
    source &&
    target &&
    submit("transfer", {
      direction,
      source: source.snapshot,
      target: target.snapshot,
      volumeHl: transferVolume,
      ...(direction === "MR_TO_PCM" && mr?.control?.current
        ? { analysisId: mr.control.current.id }
        : {}),
      confirmed: true,
      performedAt: new Date(date).toISOString(),
      notes: note,
    });
  return (
    <>
      <MaloSection title="Transférer le MR / doubler le MR">
        <div style={grid}>
          <Field label="Sens du transfert">
            <Select
              value={direction}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setDirection(e.target.value)
              }
            >
              <option value="MR_TO_PCM">MR → PCM · incorporation</option>
              <option value="PCM_TO_MR">PCM → MR · doublement</option>
            </Select>
          </Field>
          <Field label="Volume transféré (hL)">
            <Input
              aria-label="Volume transféré (hL)"
              type="number"
              min="0.001"
              step="0.001"
              value={transferVolume || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTransferVolume(Number(e.target.value))
              }
            />
          </Field>
        </div>
        <p>
          Source : {source ? volume(source.volumeHl) : "À préparer"} ·
          Destination : {target ? volume(target.volumeHl) : "À préparer"} ·
          Après : {volume((target?.volumeHl ?? 0) + transferVolume)}
        </p>
        <Btn
          onClick={transfer}
          disabled={
            !source ||
            !target ||
            !confirmed ||
            transferVolume <= 0 ||
            transferVolume > source.volumeHl ||
            dossier.status !== "EN_COURS"
          }
        >
          Valider le transfert
        </Btn>
      </MaloSection>
      <MaloSection title="Ensemencer des cuves">
        <p>
          Dose proposée : {dossier.dosePct} % du volume avant ajout. Stock PCM :{" "}
          {volume(pcm?.volumeHl ?? 0)}.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  "Choix / cuve",
                  "Lot",
                  "Avant",
                  "Dose (%)",
                  "PCM (hL)",
                  "Cuve après / capacité",
                ].map((s) => (
                  <th key={s} style={{ padding: 8 }}>
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.targets.map((l) => {
                const v = selected[l.id];
                return (
                  <tr key={l.id}>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Ensemencer ${l.containerName}`}
                          checked={!!v}
                          onChange={(e) => {
                            const next = { ...selected };
                            if (e.target.checked)
                              next[l.id] = {
                                pct: dossier.dosePct,
                                volumeHl: calculateMaloDose(
                                  l.volumeHl,
                                  dossier.dosePct,
                                ),
                              };
                            else delete next[l.id];
                            setSelected(next);
                          }}
                        />
                        {l.containerName}
                      </label>
                    </td>
                    <td>{l.name}</td>
                    <td>{volume(l.volumeHl)}</td>
                    <td>
                      {v && (
                        <Input
                          aria-label={`Dose ${l.containerName} (%)`}
                          type="number"
                          min="0.001"
                          step="any"
                          value={v.pct}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const pct = Number(e.target.value);
                            setSelected({
                              ...selected,
                              [l.id]: {
                                pct,
                                volumeHl:
                                  pct > 0
                                    ? calculateMaloDose(l.volumeHl, pct)
                                    : 0,
                              },
                            });
                          }}
                        />
                      )}
                    </td>
                    <td>
                      {v && (
                        <Input
                          aria-label={`Volume PCM ${l.containerName} (hL)`}
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={v.volumeHl}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const n = Number(e.target.value);
                            setSelected({
                              ...selected,
                              [l.id]: {
                                volumeHl: n,
                                pct: (n * 100) / l.volumeHl,
                              },
                            });
                          }}
                        />
                      )}
                    </td>
                    <td>
                      {volume(
                        (l.occupiedVolumeHl ?? l.volumeHl) +
                          (l.containerId
                            ? (additionsByContainer.get(l.containerId) ?? 0)
                            : 0),
                      )}{" "}
                      / {volume(l.capacityHl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          Besoin total : {volume(total)} · Reste PCM prévu :{" "}
          {volume((pcm?.volumeHl ?? 0) - total)}
        </p>
        {(capacityError || stale || total > (pcm?.volumeHl ?? 0)) && (
          <p role="alert">
            {capacityError ? "Capacité insuffisante. " : ""}
            {stale ? "Une destination a changé. " : ""}
            {total > (pcm?.volumeHl ?? 0) ? "Stock PCM insuffisant." : ""}
          </p>
        )}
        <p>
          {ready
            ? "Critère des deux tiers atteint — validation de l’opérateur requise."
            : maloControlLabel(pcm?.control?.reason ?? "REFERENCE_MANQUANTE") ||
              "Critère des deux tiers non atteint."}
        </p>
        <Btn
          variant="secondary"
          onClick={() =>
            submit("update", {
              plannedDestinations: Object.entries(selected).map(([id, v]) => ({
                lotId: Number(id),
                dosePct: v.pct,
              })),
            })
          }
          disabled={dossier.status !== "EN_COURS" || stale}
        >
          Enregistrer les destinataires prévus
        </Btn>
        <Btn
          style={{ marginLeft: 10 }}
          onClick={() =>
            pcm &&
            submit("distribute", {
              snapshot: pcm.snapshot,
              destinations: targets,
              initialAnalysisId: pcm.control?.initial?.id,
              currentAnalysisId: pcm.control?.current?.id,
              confirmed: true,
              performedAt: new Date(date).toISOString(),
              notes: note,
            })
          }
          disabled={
            !ready ||
            !confirmed ||
            !targets.length ||
            total <= 0 ||
            Object.values(selected).some((v) => v.volumeHl <= 0) ||
            capacityError ||
            stale ||
            total > (pcm?.volumeHl ?? 0) ||
            dossier.status !== "EN_COURS"
          }
        >
          Valider l’ensemencement
        </Btn>
      </MaloSection>
      <MaloSection title="Validation du geste">
        <Field label="Date et heure du mouvement">
          <Input
            aria-label="Date et heure du mouvement"
            type="datetime-local"
            step="0.001"
            value={date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDate(e.target.value)
            }
          />
        </Field>
        <Field label="Observations du mouvement">
          <Input
            value={note}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNote(e.target.value)
            }
          />
        </Field>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Je confirme les contrôles, les volumes et le geste réalisé.
        </label>
      </MaloSection>
    </>
  );
}
