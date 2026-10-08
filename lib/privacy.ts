export const PRIVACY_STORAGE_KEY = "ma-cuverie:privacy:v1";
export const PRIVACY_CHOICE_DURATION_MS = 180 * 24 * 60 * 60 * 1000;

export type PublicAnalyticsConfig = { enabled: boolean; endpoint: string; domain: string };
export type PrivacyChoice = { version: 1; analytics: boolean; expiresAt: number; provider: string };

export function analyticsProvider(config: PublicAnalyticsConfig) {
  return `${config.endpoint}|${config.domain}`;
}

export function parsePrivacyChoice(raw: string, provider: string): PrivacyChoice | null {
  try {
    const choice: unknown = JSON.parse(raw);
    if (typeof choice !== "object" || !choice) return null;
    const value = choice as Partial<PrivacyChoice>;
    if (value.version !== 1 || typeof value.analytics !== "boolean" || value.provider !== provider
      || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null;
    return value as PrivacyChoice;
  } catch {
    return null;
  }
}

export function isPublicAnalyticsPage(pathname: string) {
  return pathname === "/" || /^\/legal\/(mentions-legales|confidentialite|conditions-utilisation|securite|cookies)$/.test(pathname);
}
