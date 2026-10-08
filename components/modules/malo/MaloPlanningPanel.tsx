"use client";
import type { MaloDossierView } from "@/lib/malo-types";
import { MaloSection } from "./fields";
export function MaloPlanningPanel({ dossier }: { dossier: MaloDossierView }) {
  return (
    <MaloSection title="Planning des contrôles">
      <p>
        Ces dates indicatives ne remplacent pas les analyses ni la validation de
        l’opérateur.
      </p>
      {dossier.schedule.length ? (
        <ul>
          {dossier.schedule.map((s, i) => (
            <li key={i}>
              {new Date(s.date + "T12:00:00").toLocaleDateString("fr-FR")} ·{" "}
              {s.kind} · {s.label}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Renseignez les paramètres de calendrier ou enregistrez les étapes pour
          établir les contrôles.
        </p>
      )}
      <p>
        {dossier.protocol.label} · {dossier.protocol.notes}
      </p>
    </MaloSection>
  );
}
