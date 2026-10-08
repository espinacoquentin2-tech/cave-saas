"use client";
import { useState } from "react";
import { Input, Select, Btn } from "@/components/ui";
import type {
  MaloDossierView,
  MaloProfile,
  MaloProtocol,
} from "@/lib/malo-types";
import { getMaloProtocol } from "@/lib/malo-protocols";
import { Field, grid, MaloSection, type Submit } from "./fields";
export function MaloDossierPanel({
  dossier,
  submit,
  onCreated,
}: {
  dossier?: MaloDossierView;
  submit: Submit;
  onCreated?: () => void;
}) {
  const [name, setName] = useState(dossier?.name ?? ""),
    [year, setYear] = useState(dossier?.year ?? new Date().getFullYear()),
    [volume, setVolume] = useState(dossier?.plannedVolumeHl ?? 0),
    [dose, setDose] = useState(dossier?.dosePct ?? 4),
    [protocol, setProtocol] = useState<MaloProtocol>(
      dossier?.protocol ?? getMaloProtocol("CO_INOCULATION"),
    ),
    [notes, setNotes] = useState(dossier?.notes ?? "");
  const parameters = [
    "mrTemperatureMin",
    "mrTemperatureMax",
    "pcmFaTemperature",
    "pcmFmlTemperature",
    "mrMalicThreshold",
    "mrDays",
    "doublingDays",
    "pcmFirstControlDays",
    "pcmControlIntervalDays",
    "recipientFirstControlDays",
    "preparedPcmPct",
  ] as const;
  const labels: Record<(typeof parameters)[number], string> = {
    mrTemperatureMin: "MR température min. (°C)",
    mrTemperatureMax: "MR température max. (°C)",
    pcmFaTemperature: "PCM en FA (°C)",
    pcmFmlTemperature: "PCM en FML (°C)",
    mrMalicThreshold: "Seuil MR malique strictement inférieur à (g/L)",
    mrDays: "Réactivation indicative (jours)",
    doublingDays: "Après doublement (jours)",
    pcmFirstControlDays: "Premier contrôle PCM (jours)",
    pcmControlIntervalDays: "Intervalle contrôles PCM (jours)",
    recipientFirstControlDays: "Premier contrôle cuves (jours)",
    preparedPcmPct: "Volume PCM préparé documentaire (%)",
  };
  const save = async () => {
    const ok = await submit(dossier ? "update" : "create", {
      name,
      ...(!dossier ? { year, profile: protocol.profile, protocol } : {}),
      plannedVolumeHl: volume,
      dosePct: dose,
      notes,
    });
    if (ok) onCreated?.();
  };
  return (
    <MaloSection title={dossier ? "Dossier de préparation" : "Nouveau dossier"}>
      <div style={grid}>
        <Field label="Nom de la préparation">
          <Input
            aria-label="Nom de la préparation"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
          />
        </Field>
        <Field label="Millésime">
          <Input
            aria-label="Millésime"
            type="number"
            value={year}
            disabled={!!dossier}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setYear(Number(e.target.value))
            }
          />
        </Field>
        <Field label="Cuverie prévue à ensemencer (hL)">
          <Input
            type="number"
            min="0.001"
            step="0.001"
            value={volume}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setVolume(Number(e.target.value))
            }
          />
        </Field>
        <Field label="Dose proposée (%)">
          <Input
            aria-label="Dose proposée (%)"
            type="number"
            min="0.001"
            step="any"
            value={dose}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDose(Number(e.target.value))
            }
          />
        </Field>
      </div>
      <Field label="Protocole">
        <Select
          aria-label="Protocole"
          disabled={!!dossier}
          value={protocol.profile}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setProtocol(getMaloProtocol(e.target.value as MaloProfile))
          }
        >
          {(["CO_INOCULATION", "PROGRESSIVE", "CUSTOM"] as MaloProfile[]).map(
            (p) => (
              <option key={p} value={p}>
                {getMaloProtocol(p).label}
              </option>
            ),
          )}
        </Select>
      </Field>
      <p>{protocol.notes}</p>
      <details>
        <summary>Paramètres conservés dans ce dossier</summary>
        <div style={{ ...grid, marginTop: 15 }}>
          {parameters.map((k) => (
            <Field key={k} label={labels[k]}>
              <Input
                type="number"
                step="any"
                disabled={!!dossier}
                value={protocol[k] ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProtocol({
                    ...protocol,
                    [k]: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        </div>
        {!dossier && (
          <Field label="Référence et notes du protocole">
            <Input
              value={protocol.reference}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProtocol({ ...protocol, reference: e.target.value })
              }
            />
            <textarea
              aria-label="Notes du protocole"
              value={protocol.notes}
              onChange={(e) =>
                setProtocol({ ...protocol, notes: e.target.value })
              }
              style={{ width: "100%" }}
            />
          </Field>
        )}
        {protocol.reference.startsWith("https://") && (
          <a href={protocol.reference} target="_blank" rel="noreferrer">
            Consulter la référence technique
          </a>
        )}
      </details>
      <Field label="Observations du dossier">
        <textarea
          aria-label="Observations du dossier"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            width: "100%",
            minHeight: 60,
            background: "transparent",
            color: "inherit",
          }}
        />
      </Field>
      <Btn onClick={save} disabled={!name || volume <= 0 || dose <= 0}>
        {dossier ? "Enregistrer les prévisions" : "Créer le dossier"}
      </Btn>
      {dossier && (
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn
            variant="secondary"
            onClick={() =>
              submit("close", {
                status: "TERMINE",
                snapshots: dossier.lots.map((l) => l.snapshot),
                performedAt: new Date().toISOString(),
                notes,
              })
            }
          >
            Terminer le dossier
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              if (
                window.confirm(
                  "Abandonner ce dossier ? Les reliquats seront conservés et devront être traités.",
                )
              )
                void submit("close", {
                  status: "ABANDONNE",
                  snapshots: dossier.lots.map((l) => l.snapshot),
                  performedAt: new Date().toISOString(),
                  notes,
                });
            }}
          >
            Abandonner le dossier
          </Btn>
        </div>
      )}
    </MaloSection>
  );
}
