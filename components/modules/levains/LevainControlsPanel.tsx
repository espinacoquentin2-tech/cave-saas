"use client";
import { useState } from "react";
import type { PanelProps } from "./types";
import { snapshot, stateLabel } from "./types";
import {
  Field,
  Measurements,
  readMeasurements,
  textValue,
  isoValue,
  localNow,
} from "./fields";
import { LotEventMetadataDetails } from "@/components/modules/LotEventMetadataDetails";
export function LevainControlsPanel({ data, submit, busy }: PanelProps) {
  const [id, setId] = useState(""),
    [action, setAction] = useState("qualify");
  const lot =
    data.items.find((l) => String(l.lotId) === id) ??
    data.items.find((l) => l.state !== "ARCHIVE");
  if (!lot) return <p>Aucun levain à contrôler.</p>;
  return (
    <section>
      <h3>Contrôles et qualification</h3>
      <Field label="Levain à contrôler">
        <select value={lot.lotId} onChange={(e) => setId(e.target.value)}>
          {data.items
            .filter((l) => l.state !== "ARCHIVE")
            .map((l) => (
              <option key={l.lotId} value={l.lotId}>
                {l.name} — {stateLabel[l.state ?? ""]}
              </option>
            ))}
        </select>
      </Field>
      <p>
        {lot.volumeHl} hL — {stateLabel[lot.state ?? ""]}. Repères de
        propagation : 50–60 millions de cellules/mL, sucre résiduel voisin de 20
        g/L. La disponibilité est validée par l’opérateur.
      </p>
      <form
        key={lot.lotId}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            measurements = readMeasurements(f);
          if (action === "observe")
            await submit("observe", {
              lotId: lot.lotId,
              performedAt: isoValue(f, "performedAt"),
              measurements,
              comment: textValue(f, "comment"),
              ...(textValue(f, "intervention")
                ? { intervention: textValue(f, "intervention") }
                : {}),
            });
          else
            await submit("qualify", {
              snapshot: snapshot(lot),
              performedAt: isoValue(f, "performedAt"),
              measurements,
              protocolCompleted: true,
              ...(textValue(f, "missingReason")
                ? { missingMeasurementsReason: textValue(f, "missingReason") }
                : {}),
              ...(lot.state === "A_QUALIFIER"
                ? {
                    legacyResume: true,
                    protocol: {
                      reference: textValue(f, "reference"),
                      text: textValue(f, "protocol"),
                    },
                  }
                : {}),
            });
        }}
      >
        <fieldset disabled={busy}>
          <div className="levain-grid">
            <Field label="Action de contrôle">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="qualify">Qualifier pour le tirage</option>
                <option value="observe">
                  Enregistrer une mesure ou intervention
                </option>
              </select>
            </Field>
            <Field label="Date du contrôle">
              <input
                name="performedAt"
                type="datetime-local"
                defaultValue={localNow()}
                required
              />
            </Field>
            <Measurements />
            {action === "qualify" ? (
              <>
                <Field label="Motif des mesures indisponibles">
                  <textarea name="missingReason" />
                </Field>
                {lot.state === "A_QUALIFIER" && (
                  <>
                    <Field label="Référence du protocole historique">
                      <input name="reference" required />
                    </Field>
                    <Field label="Préparation historique réalisée">
                      <textarea name="protocol" required />
                    </Field>
                    <p>
                      Cette reprise conserve les volumes et ne consomme pas une
                      seconde fois les LSA historiques.
                    </p>
                  </>
                )}
                <label>
                  <input type="checkbox" required /> Je confirme le protocole
                  réalisé et la disponibilité du levain.
                </label>
              </>
            ) : (
              <>
                <Field label="Intervention réalisée">
                  <select name="intervention">
                    <option value="">Mesures seules</option>
                    <option value="AERATION">Aération</option>
                    <option value="AGITATION">Agitation</option>
                  </select>
                </Field>
                <Field label="Observations">
                  <textarea name="comment" />
                </Field>
              </>
            )}
          </div>
          <button type="submit">
            {action === "qualify"
              ? "Qualifier le levain"
              : "Enregistrer le contrôle"}
          </button>
        </fieldset>
      </form>
      <h4>Historique</h4>
      {lot.events.map((event) => (
        <details key={event.id}>
          <summary>
            {new Date(event.eventDatetime).toLocaleString("fr-FR")} —{" "}
            {event.eventType.replaceAll("_", " ").toLowerCase()}
          </summary>
          <LotEventMetadataDetails metadata={event.metadata} />
        </details>
      ))}
    </section>
  );
}
