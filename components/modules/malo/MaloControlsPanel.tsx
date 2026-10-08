"use client";
import { useState } from "react";
import { Btn, Select } from "@/components/ui";
import { AnalyseModal } from "@/components/modules/analyses/AnalyseModal";
import type { MaloDossierView, MaloLotView } from "@/lib/malo-types";
import { maloControlLabel } from "@/lib/malo";
import { MaloSection, Field, type Submit } from "./fields";
export function MaloControlsPanel({
  dossier,
  submit,
  refresh,
}: {
  dossier: MaloDossierView;
  submit: Submit;
  refresh: () => Promise<unknown>;
}) {
  const [analysisLot, setAnalysisLot] = useState<MaloLotView | null>(null),
    [reference, setReference] = useState(0);
  return (
    <>
      <MaloSection title="Analyses et référence initiale">
        {dossier.lots.length === 0 && (
          <p>Préparez un MR ou un PCM pour enregistrer ses analyses.</p>
        )}
        {dossier.lots.map((l) => (
          <div
            key={l.id}
            style={{
              padding: 12,
              marginBottom: 12,
              border: "1px solid #8884",
              borderRadius: 6,
            }}
          >
            <h3>
              {l.role} · {l.name}
            </h3>
            {l.role === "PCM" && (
              <p>
                {l.control?.reason
                  ? maloControlLabel(l.control.reason)
                  : l.control?.consumptionPct != null
                    ? `${l.control.consumptionPct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % consommés · ${l.control.criterionReached ? "Deux tiers atteints — à valider pour distribution" : "Critère non atteint"}`
                    : "Référence initiale manquante"}
              </p>
            )}
            {l.role === "MR" && (
              <p>
                {l.control?.representative
                  ? "Contrôle représentatif disponible"
                  : "Contrôle manquant ou antérieur devenu non représentatif"}
              </p>
            )}
            {l.control?.current && (
              <p>
                Dernier prélèvement :{" "}
                {new Date(l.control.current.analysisDate).toLocaleString(
                  "fr-FR",
                )}{" "}
                · Acide malique :{" "}
                {String(l.control.current.extraData.malique ?? "Non renseigné")}{" "}
                g/L
              </p>
            )}
            <Btn
              onClick={() => setAnalysisLot(l)}
              disabled={
                !l.containerId ||
                !l.snapshot.compositionEventId ||
                dossier.status !== "EN_COURS"
              }
            >
              Ajouter une analyse {l.role}
            </Btn>
            {l.role === "PCM" && (
              <div style={{ marginTop: 12 }}>
                <Btn
                  variant="secondary"
                  onClick={() =>
                    submit("homogenize", {
                      snapshot: l.snapshot,
                      confirmed: true,
                      performedAt: new Date().toISOString(),
                    })
                  }
                  disabled={!l.volumeHl || dossier.status !== "EN_COURS"}
                >
                  Confirmer l’homogénéisation après incorporation du MR
                </Btn>
                <Field label="Analyse initiale du PCM">
                  <Select
                    aria-label="Analyse initiale du PCM"
                    value={reference || ""}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setReference(Number(e.target.value))
                    }
                  >
                    <option value="">
                      Choisir le prélèvement de référence
                    </option>
                    {l.analyses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {new Date(a.analysisDate).toLocaleString("fr-FR")} ·{" "}
                        {String(a.extraData.malique ?? "Non renseigné")} g/L
                      </option>
                    ))}
                  </Select>
                </Field>
                <Btn
                  onClick={() =>
                    submit("reference", {
                      snapshot: l.snapshot,
                      analysisId: reference,
                      performedAt: new Date().toISOString(),
                    })
                  }
                  disabled={
                    !reference ||
                    !l.homogenized ||
                    dossier.status !== "EN_COURS"
                  }
                >
                  Enregistrer la référence initiale
                </Btn>
                {l.control?.initial && (
                  <p>
                    Référence : {String(l.control.initial.extraData.malique)}{" "}
                    g/L ·{" "}
                    {new Date(l.control.initial.analysisDate).toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                )}
              </div>
            )}
            <details style={{ marginTop: 10 }}>
              <summary>Historique des analyses ({l.analyses.length})</summary>
              {l.analyses.map((a) => (
                <p key={a.id}>
                  {new Date(a.analysisDate).toLocaleString("fr-FR")} · pH{" "}
                  {a.ph ?? "—"} · SO₂ {a.so2Free ?? "—"} / {a.so2Total ?? "—"}{" "}
                  mg/L · malique {String(a.extraData.malique ?? "—")} g/L ·{" "}
                  {String(
                    (a.extraData.malo as Record<string, unknown> | undefined)
                      ?.containerId ?? "Contenant non renseigné",
                  )}
                </p>
              ))}
            </details>
          </div>
        ))}
      </MaloSection>
      {analysisLot &&
        analysisLot.containerId &&
        analysisLot.snapshot.compositionEventId && (
          <AnalyseModal
            title={`Analyse du ${analysisLot.role}`}
            maloContext={{
              lotId: analysisLot.id,
              preparationId: dossier.id,
              role: analysisLot.role!,
              containerId: analysisLot.containerId,
              compositionEventId: analysisLot.snapshot.compositionEventId,
            }}
            onClose={() => setAnalysisLot(null)}
            onSuccess={() => {
              setAnalysisLot(null);
              void refresh();
            }}
          />
        )}
    </>
  );
}
