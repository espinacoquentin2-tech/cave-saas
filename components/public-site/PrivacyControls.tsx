"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  analyticsProvider, isPublicAnalyticsPage, parsePrivacyChoice,
  PRIVACY_CHOICE_DURATION_MS, PRIVACY_STORAGE_KEY,
  type PrivacyChoice, type PublicAnalyticsConfig,
} from "@/lib/privacy";

const CHANGE_EVENT = "ma-cuverie:privacy-changed";
let memoryChoice = "";
let memoryOnly = false;

function snapshot() {
  if (memoryOnly) return memoryChoice;
  try { return localStorage.getItem(PRIVACY_STORAGE_KEY) || ""; }
  catch { return memoryChoice; }
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}
function serverSnapshot() { return ""; }

export function PrivacyControls({ analytics }: { analytics: PublicAnalyticsConfig }) {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const provider = analyticsProvider(analytics);
  const choice = parsePrivacyChoice(raw, provider);
  const [editing, setEditing] = useState(false);
  const lastPageview = useRef("");

  const choose = (accepted: boolean) => {
    const next: PrivacyChoice = { version: 1, analytics: accepted, expiresAt: Date.now() + PRIVACY_CHOICE_DURATION_MS, provider };
    memoryChoice = JSON.stringify(next);
    try { localStorage.setItem(PRIVACY_STORAGE_KEY, memoryChoice); memoryOnly = false; }
    catch { memoryOnly = true; /* Préférence en mémoire si le stockage est bloqué. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setEditing(false);
  };

  useEffect(() => {
    if (!analytics.enabled || !choice?.analytics || !isPublicAnalyticsPage(pathname)) {
      lastPageview.current = "";
      return;
    }
    const controller = new AbortController();
    const send = (name: "pageview" | "DemandeDemo") => {
      // Relire la préférence à chaque envoi : un retrait dans un autre onglet prend effet immédiatement.
      if (!parsePrivacyChoice(snapshot(), provider)?.analytics) return;
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      void fetch(analytics.endpoint, {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ name, domain: analytics.domain, url: url.href }),
        signal: controller.signal,
      }).catch(() => { /* La mesure d'audience ne doit jamais bloquer la navigation. */ });
    };
    const pageviewKey = `${provider}|${pathname}|${raw}`;
    if (lastPageview.current !== pageviewKey) {
      lastPageview.current = pageviewKey;
      send("pageview");
    }
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[data-demo-cta]")) send("DemandeDemo");
    };
    document.addEventListener("click", onClick);
    return () => {
      controller.abort();
      document.removeEventListener("click", onClick);
    };
  }, [analytics.enabled, analytics.endpoint, analytics.domain, pathname, provider, raw, choice?.analytics]);

  return (
    <>
      <button className={`privacy-trigger${pathname.startsWith("/app") ? " privacy-trigger-app" : ""}`} onClick={() => setEditing(true)} aria-expanded={!choice || editing} aria-controls="privacy-panel">
        Préférences cookies
      </button>
      {(!choice || editing) && (
        <section className="privacy-panel" id="privacy-panel" aria-label="Choix de confidentialité">
          <h2>Votre confidentialité</h2>
          <p>Le stockage nécessaire permet la connexion et mémorise vos préférences. La mesure d&apos;audience Plausible est facultative et concerne uniquement le site public.</p>
          {!analytics.enabled && <p>La mesure d&apos;audience est actuellement désactivée. Votre choix sera mémorisé.</p>}
          <p>Vous pouvez refuser et modifier votre choix à tout moment. <Link href="/legal/cookies">En savoir plus</Link></p>
          <div className="privacy-actions">
            <button onClick={() => choose(false)}>Tout refuser</button>
            <button onClick={() => choose(true)}>Tout accepter</button>
            {choice && <button className="privacy-close" onClick={() => setEditing(false)}>Fermer</button>}
          </div>
        </section>
      )}
    </>
  );
}
