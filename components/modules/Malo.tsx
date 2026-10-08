"use client";
import { useState } from "react";
import { Btn, Select, Badge } from "@/components/ui";
import { useTheme, useAuth } from "@/lib/store";
import { getCurrentUserRoleKey } from "@/lib/roles";
import type { MaloRole } from "@/lib/malo-types";
import { useMaloOperations } from "./malo/useMaloOperations";
import { MaloDossierPanel } from "./malo/MaloDossierPanel";
import { MaloPreparationPanel } from "./malo/MaloPreparationPanel";
import { MaloControlsPanel } from "./malo/MaloControlsPanel";
import { MaloDistributionPanel } from "./malo/MaloDistributionPanel";
import { MaloPlanningPanel } from "./malo/MaloPlanningPanel";
import { MaloSection, volume } from "./malo/fields";
import { LotEventMetadataDetails } from "./LotEventMetadataDetails";
export function Malo({
  preparationId,
  containerId,
  role,
}: {
  preparationId?: number;
  containerId?: number;
  role?: MaloRole;
}) {
  const T = useTheme(),
    { user } = useAuth(),
    [selected, setSelected] = useState(preparationId ?? 0),
    [creating, setCreating] = useState(false),
    [tab, setTab] = useState(containerId ? "Préparation" : "Dossier");
  const op = useMaloOperations((id) => {
    setSelected(id);
    setCreating(false);
  });
  const dossier = op.data.items.find(
      (p) => p.id === (selected || op.data.items[0]?.id),
    ),
    readOnly = getCurrentUserRoleKey(user) === "LECTURE_SEULE";
  const submit = (action: string, payload: Record<string, unknown>) => {
    if (readOnly) return Promise.resolve(false);
    const path =
      action === "create"
        ? "/api/malo"
        : `/api/malo/${dossier?.id}${action === "update" ? "" : "/" + action}`;
    return op.submit(path, payload, action === "update" ? "PATCH" : "POST");
  };
  const frozen = op.busy || op.pending;
  return (
    <div className="malo-workspace" style={{ color: T.text }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 32,
              color: T.textStrong,
              margin: 0,
            }}
          >
            Malo
          </h1>
          <p>
            Milieux de réactivation → pieds de cuve malo → cuves ensemencées
          </p>
        </div>
        <Btn
          onClick={() => {
            setCreating(true);
            setTab("Dossier");
          }}
          disabled={readOnly || frozen}
        >
          Nouveau dossier
        </Btn>
      </div>
      {op.error && (
        <p role="alert" style={{ color: T.red }}>
          {op.error}
        </p>
      )}
      {op.message && (
        <p role="status" style={{ color: T.green }}>
          {op.message}
        </p>
      )}
      {op.pending && (
        <Btn onClick={op.retry} disabled={op.busy}>
          Vérifier ou réessayer la même opération
        </Btn>
      )}
      {op.loading && <p>Chargement des dossiers…</p>}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Select
          aria-label="Dossier Malo"
          value={dossier?.id ?? ""}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setSelected(Number(e.target.value));
            setCreating(false);
          }}
          disabled={frozen}
        >
          <option value="">Choisir un dossier</option>
          {op.data.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.year} · {p.status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Btn
          variant="secondary"
          onClick={() => {
            void op.refresh();
          }}
          disabled={frozen}
        >
          Actualiser
        </Btn>
      </div>
      {!creating && dossier && (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {dossier.lots.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: 12,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                }}
              >
                <Badge label={l.role} color={T.accent} />
                <span style={{ marginLeft: 8 }}>
                  {l.containerName} · {volume(l.volumeHl)} ·{" "}
                  {l.status.replaceAll("_", " ")}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            {[
              "Dossier",
              "Préparation",
              "Contrôles",
              "Distribution",
              "Planning",
              "Historique",
            ].map((t) => (
              <Btn
                key={t}
                variant={t === tab ? "primary" : "secondary"}
                onClick={() => setTab(t)}
                disabled={frozen}
              >
                {t}
              </Btn>
            ))}
          </div>
        </>
      )}
      <fieldset
        disabled={frozen}
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        {creating || !dossier ? (
          <fieldset disabled={readOnly} style={{ border: 0, padding: 0 }}>
            <MaloDossierPanel
              key="new"
              submit={submit}
              onCreated={() => setCreating(false)}
            />
          </fieldset>
        ) : (
          <div key={`${dossier.id}-${tab}`}>
            <fieldset
              disabled={readOnly || dossier.status !== "EN_COURS"}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              {tab === "Dossier" && (
                <MaloDossierPanel dossier={dossier} submit={submit} />
              )}{" "}
              {tab === "Préparation" && (
                <MaloPreparationPanel
                  dossier={dossier}
                  data={op.data}
                  submit={submit}
                  initialContainerId={containerId}
                  initialRole={role}
                />
              )}{" "}
              {tab === "Distribution" && (
                <MaloDistributionPanel
                  dossier={dossier}
                  data={op.data}
                  submit={submit}
                />
              )}
            </fieldset>
            {tab === "Contrôles" && (
              <fieldset disabled={readOnly} style={{ border: 0, padding: 0 }}>
                <MaloControlsPanel
                  dossier={dossier}
                  submit={submit}
                  refresh={op.refresh}
                />
              </fieldset>
            )}
            {tab === "Planning" && <MaloPlanningPanel dossier={dossier} />}{" "}
            {tab === "Historique" && (
              <MaloSection title="Historique du dossier">
                {dossier.events.map((e) => (
                  <article
                    key={e.id}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      padding: 12,
                    }}
                  >
                    <strong>{e.eventType.replaceAll("_", " ")}</strong> ·{" "}
                    {new Date(e.eventDatetime).toLocaleString("fr-FR")}
                    <p>{e.comment}</p>
                    <LotEventMetadataDetails metadata={e.metadata} />
                  </article>
                ))}
                {!dossier.events.length && <p>Aucun geste enregistré.</p>}
              </MaloSection>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}
