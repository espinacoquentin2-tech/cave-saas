"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth, useStore } from "@/lib/store";
import {
  buildApiHeaders,
  extractApiErrorMessage,
} from "@/lib/client-app-helpers";
import type { MaloWorkspace } from "@/lib/malo-types";
const empty: MaloWorkspace = {
  items: [],
  sources: [],
  targets: [],
  containers: [],
  products: [],
};
export function useMaloOperations(onSaved?: (id: number) => void) {
  const { user } = useAuth(),
    { refreshData } = useStore();
  const [data, setData] = useState(empty),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const lock = useRef(false),
    request = useRef<{
      path: string;
      payload: Record<string, unknown>;
      method: string;
      key: string;
    } | null>(null);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/malo", {
      headers: buildApiHeaders(user),
      cache: "no-store",
    });
    const b = await r.json();
    if (!r.ok) throw new Error(extractApiErrorMessage(b));
    setData(b.data);
    return b.data as MaloWorkspace;
  }, [user]);
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  const submit = async (
    path: string,
    payload: Record<string, unknown>,
    method = "POST",
  ): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    if (!request.current)
      request.current = {
        path,
        payload: structuredClone(payload),
        method,
        key: crypto.randomUUID(),
      };
    const current = request.current;
    try {
      const r = await fetch(current.path, {
        method: current.method,
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          ...current.payload,
          idempotencyKey: current.key,
        }),
      });
      const b = await r.json();
      if (!r.ok) {
        if (r.status >= 500) throw new Error("Réponse incertaine");
        if (r.status === 409) {
          const latest = await refresh();
          const found = latest.items.find(
            (d) =>
              d.events.some((e) => e.metadata.idempotencyKey === current.key) ||
              d.lots.some((l) =>
                l.analyses.some(
                  (a) => a.extraData.idempotencyKey === current.key,
                ),
              ),
          );
          if (found) {
            onSaved?.(found.id);
            request.current = null;
            setPending(false);
            setMessage("Opération enregistrée, résultat retrouvé.");
            await refreshData?.().catch(() =>
              setError("Enregistrement confirmé ; actualisez la cuverie."),
            );
            return true;
          }
        }
        request.current = null;
        setPending(false);
        throw new Error(extractApiErrorMessage(b));
      }
      request.current = null;
      setPending(false);
      if (b.data?.preparationId) onSaved?.(b.data.preparationId);
      setMessage("Opération enregistrée.");
      try {
        await refresh();
        await refreshData?.();
      } catch {
        setError("Enregistrement confirmé ; actualisez les données.");
      }
      return true;
    } catch (e) {
      if (request.current) {
        setPending(true);
        setError(
          "Réponse inconnue : vérifiez ou réessayez cette même opération avant de saisir un nouvel apport.",
        );
      } else setError(e instanceof Error ? e.message : "Opération impossible");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const retry = () =>
    request.current
      ? submit(
          request.current.path,
          request.current.payload,
          request.current.method,
        )
      : Promise.resolve(false);
  return {
    data,
    busy,
    loading,
    error,
    message,
    pending,
    refresh,
    submit,
    retry,
  };
}
