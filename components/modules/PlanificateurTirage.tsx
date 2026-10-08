"use client";
import { useState } from "react";
import { useTheme } from "@/lib/store";
import { useLevainOperations } from "./levains/useLevainOperations";
import { LevainPlanningPanel } from "./levains/LevainPlanningPanel";
import { LevainPreparationPanel } from "./levains/LevainPreparationPanel";
import { LevainControlsPanel } from "./levains/LevainControlsPanel";
import { LevainFeedingPanel } from "./levains/LevainFeedingPanel";
import { LevainMixtionPanel } from "./levains/LevainMixtionPanel";
export function PlanificateurTirage() {
  const T = useTheme(),
    api = useLevainOperations(),
    [tab, setTab] = useState("Planning"),
    [plan, setPlan] = useState<unknown>();
  const props = {
    data: api.data,
    submit: api.submit,
    busy: api.busy || api.pending,
    plan,
  };
  return (
    <div
      className="levain-workspace"
      style={{
        color: T.text,
        background: T.surface,
        padding: 20,
        borderRadius: 12,
      }}
    >
      <h2>Levains et tirage</h2>
      <p>
        Préparer et suivre le levain, constituer la mixtion puis enregistrer le
        tirage.
      </p>
      <nav aria-label="Étapes du levain" className="levain-tabs">
        {[
          "Planning",
          "Préparation",
          "Contrôles",
          "Nourrissage",
          "Mixtion et tirage",
        ].map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={tab === label}
            disabled={api.busy || api.pending}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </nav>
      {api.error && <p role="alert">{api.error}</p>}
      <p role="status" aria-live="polite">
        {api.message}
      </p>
      {api.pending && (
        <button type="button" disabled={api.busy} onClick={api.retry}>
          Vérifier ou réessayer la même opération
        </button>
      )}
      {tab === "Planning" && (
        <LevainPlanningPanel
          onPlan={(p) => {
            setPlan(p);
            setTab("Préparation");
          }}
        />
      )}
      {tab === "Préparation" && <LevainPreparationPanel {...props} />}{" "}
      {tab === "Contrôles" && <LevainControlsPanel {...props} />}{" "}
      {tab === "Nourrissage" && <LevainFeedingPanel {...props} />}{" "}
      {tab === "Mixtion et tirage" && <LevainMixtionPanel {...props} />}
      <style jsx global>{`
        .levain-workspace {
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .levain-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 18px;
        }
        .levain-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(240px, 100%), 1fr)
          );
          gap: 16px;
          margin: 16px 0;
        }
        .levain-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .levain-workspace input,
        .levain-workspace select,
        .levain-workspace textarea {
          font: inherit;
          color: inherit;
          background: ${T.bg};
          border: 1px solid ${T.borderLight};
          padding: 10px;
          border-radius: 6px;
          max-width: 100%;
          box-sizing: border-box;
        }
        .levain-workspace input[type="checkbox"] {
          width: auto;
        }
        .levain-workspace button {
          font: inherit;
          border: 1px solid ${T.borderLight};
          border-radius: 6px;
          padding: 10px 14px;
          background: ${T.surfaceHigh};
          color: ${T.textStrong};
          cursor: pointer;
          margin: 4px;
        }
        .levain-workspace button[aria-pressed="true"] {
          border-color: ${T.accent};
          background: ${T.accentDim};
        }
        .levain-workspace button:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .levain-workspace fieldset {
          padding: 0;
          border: 0;
          min-width: 0;
        }
        .levain-workspace textarea {
          min-height: 90px;
        }
        .levain-table {
          overflow: auto;
        }
        .levain-workspace table {
          border-collapse: collapse;
          min-width: 600px;
        }
        .levain-workspace td,
        .levain-workspace th {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid ${T.border};
        }
        .levain-workspace [role="alert"] {
          color: ${T.textStrong};
          border: 1px solid ${T.red};
          padding: 12px;
        }
        .levain-workspace details {
          margin: 10px 0;
        }
      `}</style>
    </div>
  );
}
