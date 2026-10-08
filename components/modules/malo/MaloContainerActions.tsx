"use client";
import { useState, useRef } from "react";
import {
  buildApiHeaders,
  extractApiErrorMessage,
} from "@/lib/client-app-helpers";
import { Btn, Badge } from "@/components/ui";
import { useStore, useAuth, useTheme } from "@/lib/store";
import { getCurrentUserRoleKey } from "@/lib/roles";
export function MaloContainerActions({
  container,
}: {
  container: {
    id: string | number;
    usage?: string;
    status: string;
    currentVolume?: number;
  };
}) {
  const { state, refreshData } = useStore(),
    { user } = useAuth(),
    T = useTheme();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const usageKey = useRef<string | null>(null);
  const clearUsage = async () => {
    setBusy(true);
    setError("");
    usageKey.current ??= crypto.randomUUID();
    try {
      const r = await fetch("/api/containers", {
        method: "PUT",
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          id: Number(container.id),
          usage: null,
          idempotencyKey: usageKey.current,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(extractApiErrorMessage(b));
      usageKey.current = null;
      await refreshData?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modification impossible");
    } finally {
      setBusy(false);
    }
  };
  const lot = (state.lots ?? []).find(
    (l: {
      currentContainerId?: string | number;
      maloPreparationId?: number;
      currentVolume: number;
    }) =>
      String(l.currentContainerId) === String(container.id) &&
      l.maloPreparationId &&
      Number(l.currentVolume) > 0,
  );
  const open = (detail: Record<string, unknown>) =>
    window.dispatchEvent(new CustomEvent("open-malo", { detail }));
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      {error && <p role="alert">{error}</p>}
      {container.usage &&
        !lot &&
        Number(container.currentVolume ?? 0) === 0 &&
        getCurrentUserRoleKey(user) !== "LECTURE_SEULE" && (
          <Btn variant="secondary" disabled={busy} onClick={clearUsage}>
            Réaffecter à la cuverie
          </Btn>
        )}
      {container.usage && <Badge label={container.usage} color={T.accent} />}{" "}
      {lot ? (
        <Btn
          variant="secondary"
          onClick={() => open({ preparationId: lot.maloPreparationId })}
        >
          Ouvrir le dossier {lot.maloRole}
        </Btn>
      ) : container.status === "VIDE" &&
        Number(container.currentVolume ?? 0) === 0 &&
        getCurrentUserRoleKey(user) !== "LECTURE_SEULE" ? (
        <>
          <Btn
            variant="secondary"
            onClick={() =>
              open({ containerId: Number(container.id), role: "MR" })
            }
          >
            Préparer un MR
          </Btn>
          <Btn
            variant="secondary"
            onClick={() =>
              open({ containerId: Number(container.id), role: "PCM" })
            }
          >
            Préparer un PCM
          </Btn>
        </>
      ) : null}
    </div>
  );
}
export function MaloReceivedHistory({
  containerId,
  lotId,
}: {
  containerId?: number;
  lotId?: number;
}) {
  const { state } = useStore();
  const found = new Map<
    string,
    { event: Record<string, unknown>; destination: Record<string, unknown> }
  >();
  for (const event of state.events ?? []) {
    if (event.metadata?.operation !== "ENSEMENCEMENT_MALO") continue;
    for (const d of event.metadata.destinations ?? []) {
      if (
        (containerId && Number(d.containerId) === containerId) ||
        (lotId && Number(d.lotId) === lotId)
      )
        found.set(`${event.id}:${d.lotId}`, { event, destination: d });
    }
  }
  if (!found.size) return null;
  return (
    <section
      style={{
        padding: 16,
        border: "1px solid #8884",
        borderRadius: 6,
        marginBottom: 16,
      }}
    >
      <h3>Ensemencements malo reçus</h3>
      {[...found.values()].map(({ event, destination }) => {
        const metadata = event.metadata as Record<string, unknown>;
        return (
          <p key={`${event.id}:${destination.lotId}`}>
            {String(metadata.pcmName ?? `PCM #${metadata.pcmLotId}`)} ·{" "}
            {new Date(
              String(event.eventDatetime ?? event.createdAt ?? event.date),
            ).toLocaleString("fr-FR")}{" "}
            · {String(destination.volumeHl)} hL{" "}
            <Btn
              variant="secondary"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-malo", {
                    detail: { preparationId: Number(metadata.preparationId) },
                  }),
                )
              }
            >
              Voir le dossier
            </Btn>
          </p>
        );
      })}
    </section>
  );
}
