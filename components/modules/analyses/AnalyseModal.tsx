"use client";
import { useState } from "react";
import { Modal, Input, Select, Btn } from "@/components/ui";
import { useStore, useAuth } from "@/lib/store";
import {
  buildApiHeaders,
  extractApiErrorMessage,
} from "@/lib/client-app-helpers";
import { Field, grid, localTime } from "@/components/modules/malo/fields";
const fields = [
  ["ph", "pH", ""],
  ["at", "AT", "g/L"],
  ["so2Free", "SO₂ libre", "mg/L"],
  ["so2Total", "SO₂ total", "mg/L"],
  ["alcohol", "TAV", "% vol"],
  ["malique", "Acide malique", "g/L"],
  ["temperatureC", "Température", "°C"],
  ["density", "Masse volumique mesurée", "g/L"],
  ["density20", "Masse volumique corrigée à 20 °C", "g/L"],
  ["sucresResiduel", "Sucres résiduels GF", "g/L"],
  ["aciditeVolatile", "Acidité volatile", "g/L"],
] as const;
export type MaloAnalysisContext = {
  preparationId: number;
  role: "MR" | "PCM";
  containerId: number;
  compositionEventId: number;
  lotId: number;
};
type Props = {
  initial?: Record<string, unknown> | null;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  maloContext?: MaloAnalysisContext;
};
export function AnalyseModal({
  initial,
  onClose,
  onSuccess,
  title,
  maloContext,
}: Props) {
  const { state } = useStore(),
    { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        fields.map(([k]) => [
          k,
          String(
            initial?.[k] ??
              (initial?.extraData as Record<string, unknown> | undefined)?.[
                k
              ] ??
              "",
          ),
        ]),
      ),
    ),
    [lot, setLot] = useState(
      String(maloContext?.lotId ?? initial?.lotId ?? ""),
    ),
    [date, setDate] = useState(
      initial?.analysisDate
        ? String(initial.analysisDate).slice(0, 10) + "T12:00"
        : localTime(),
    ),
    [notes, setNotes] = useState(String(initial?.notes ?? "")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Record<string, unknown> | null>(null),
    [key] = useState(() => crypto.randomUUID());
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const sampledAt = new Date(date).toISOString();
      const extra: Record<string, unknown> = {
        ...((initial?.extraData ?? {}) as Record<string, unknown>),
      };
      const row: Record<string, unknown> = {
        lotId: Number(lot),
        analysisDate: sampledAt,
        notes,
      };
      for (const [k] of fields) {
        const value =
          values[k] === "" ? null : Number(values[k].replace(",", "."));
        if (value != null && !Number.isFinite(value))
          throw new Error("Mesure invalide");
        if (["ph", "at", "so2Free", "so2Total", "alcohol"].includes(k))
          row[k] = value;
        else extra[k] = value;
      }
      if (maloContext) {
        const { preparationId, role, containerId, compositionEventId } =
          maloContext;
        const context = {
          preparationId,
          role,
          containerId,
          compositionEventId,
        };
        extra.malo = { ...context, schemaVersion: 1, sampledAt };
      }
      row.extraData = extra;
      const payload = pending ?? { analyses: [row], idempotencyKey: key };
      setPending(payload);
      const r = await fetch("/api/analyses", {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload),
      });
      const b = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          const read = await fetch("/api/analyses", {
            headers: buildApiHeaders(user),
          });
          const records = await read.json();
          if (
            read.ok &&
            Array.isArray(records) &&
            records.some((a) => a.extraData?.idempotencyKey === key)
          ) {
            setPending(null);
            onSuccess();
            return;
          }
        }
        if (r.status < 500) setPending(null);
        throw new Error(extractApiErrorMessage(b));
      }
      setPending(null);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title ?? "Saisir une analyse"}
      onClose={busy || pending ? () => {} : onClose}
    >
      <fieldset disabled={busy || !!pending} style={{ border: 0, padding: 0 }}>
        <div style={grid}>
          <Field label="Date et heure du prélèvement">
            <Input
              aria-label="Date et heure du prélèvement"
              type="datetime-local"
              step="0.001"
              value={date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDate(e.target.value)
              }
            />
          </Field>
          <Field label="Lot analysé">
            <Select
              aria-label="Lot analysé"
              value={lot}
              disabled={!!maloContext}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setLot(e.target.value)
              }
            >
              <option value="">Choisir un lot</option>
              {maloContext ? (
                <option value={lot}>
                  Lot #{lot} · {maloContext.role}
                </option>
              ) : (
                (state.lots ?? [])
                  .filter((l: { maloRole?: string }) => !l.maloRole)
                  .map(
                    (l: {
                      id: number | string;
                      code?: string;
                      businessCode?: string;
                    }) => (
                      <option key={l.id} value={l.id}>
                        {l.businessCode ?? l.code}
                      </option>
                    ),
                  )
              )}
            </Select>
          </Field>
        </div>
        <div style={grid}>
          {fields.map(([k, label, unit]) => (
            <Field key={k} label={`${label}${unit ? " (" + unit + ")" : ""}`}>
              <Input
                aria-label={label}
                inputMode="decimal"
                value={values[k]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setValues({ ...values, [k]: e.target.value })
                }
              />
            </Field>
          ))}
        </div>
        <Field label="Observations analytiques">
          <Input
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNotes(e.target.value)
            }
          />
        </Field>
      </fieldset>
      {error && (
        <p role="alert">
          {error}
          {pending ? " · Réponse inconnue : réessayez avec la même clé." : ""}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose} disabled={busy || !!pending}>
          Annuler
        </Btn>
        <Btn onClick={save} disabled={busy || !lot || !date}>
          {pending ? "Vérifier ou réessayer la même analyse" : "Enregistrer"}
        </Btn>
      </div>
    </Modal>
  );
}
