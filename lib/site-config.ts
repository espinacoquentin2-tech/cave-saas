import "server-only";

const configuredUrl = new URL(process.env.SITE_URL || "https://macuverie.fr");
if (configuredUrl.protocol !== "https:" || configuredUrl.username || configuredUrl.password) {
  throw new Error("SITE_URL doit être une URL publique HTTPS sans identifiants.");
}

export const SITE_ORIGIN = configuredUrl.origin;
export const SITE_DESCRIPTION = "Logiciel de gestion de cave, cuverie, lots, stocks, analyses, dégustations et traçabilité pour domaines, maisons et caves.";

export function getPublicAnalyticsConfig() {
  const enabled = process.env.ANALYTICS_ENABLED === "true";
  const endpoint = new URL(process.env.ANALYTICS_ENDPOINT || "https://plausible.io/api/event");
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("ANALYTICS_ENDPOINT doit être une URL HTTPS sans identifiants ni paramètres.");
  }
  return {
    enabled,
    endpoint: endpoint.href,
    domain: process.env.ANALYTICS_DOMAIN || configuredUrl.hostname,
  };
}
