"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth, useStore } from "@/lib/store";
import {
  buildApiHeaders,
  extractApiErrorMessage,
} from "@/lib/client-app-helpers";
import type { LevainData } from "./types";
const empty: LevainData = {
  items: [],
  wines: [],
  mixtions: [],
  products: [],
  emptyTanks: [],
};
const routes: Record<string, string> = {
  create: "/api/levains",
  prepare: "/api/levains/preparation",
  qualify: "/api/levains/qualify",
  observe: "/api/levains/observations",
  feed: "/api/levains/feed",
  mixtion: "/api/tirage/mixtions",
  check: "/api/tirage/mixtions/check",
  tirage: "/api/tirage",
};
export function useLevainOperations() {
  const { user } = useAuth(),
    { refreshData } = useStore();
  const [data, setData] = useState(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const request = useRef<{
      operation: string;
      payload: Record<string, unknown>;
      key: string;
    } | null>(null),
    lock = useRef(false);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/levains", {
      headers: buildApiHeaders(user),
      cache: "no-store",
    });
    const body = await r.json();
    if (!r.ok) throw new Error(extractApiErrorMessage(body));
    setData(body.data);
    return body.data as LevainData;
  }, [user]);
  useEffect(() => {
    let active = true;
    refresh().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [refresh]);
  const submit = async (
    operation: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    if (!request.current)
      request.current = { operation, payload, key: crypto.randomUUID() };
    const current = request.current;
    try {
      const r = await fetch(routes[current.operation], {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          ...current.payload,
          idempotencyKey: current.key,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        if (r.status >= 500) throw new Error("Réponse serveur incertaine.");
        if (r.status === 409) {
          const latest = await refresh();
          const events = [...latest.items, ...latest.mixtions].flatMap(
            (l) => l.events,
          );
          if (events.some((e) => e.metadata?.idempotencyKey === current.key)) {
            request.current = null;
            setPending(false);
            setMessage("Opération enregistrée, résultat retrouvé.");
            if (refreshData) await refreshData();
            return true;
          }
        }
        request.current = null;
        setPending(false);
        throw new Error(extractApiErrorMessage(body));
      }
      request.current = null;
      setPending(false);
      setMessage("Opération enregistrée.");
      await refresh();
      if (refreshData) await refreshData();
      return true;
    } catch (e) {
      if (request.current) {
        setPending(true);
        setError(
          "Réponse inconnue : vérifiez ou réessayez cette même opération avant de saisir un nouvel apport.",
        );
      } else setError(e instanceof Error ? e.message : "Opération impossible.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const retry = () =>
    request.current
      ? submit(request.current.operation, request.current.payload)
      : Promise.resolve(false);
  return { data, busy, error, message, pending, refresh, submit, retry };
}
