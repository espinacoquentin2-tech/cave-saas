"use client";
import type { ReactNode } from "react";
import { useTheme } from "@/lib/store";
export function MaloSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const T = useTheme();
  return (
    <section
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 18, color: T.textStrong, marginTop: 0 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const T = useTheme();
  return (
    <label
      style={{
        display: "block",
        marginBottom: 12,
        color: T.textDim,
        fontSize: 12,
      }}
    >
      {label}
      <div style={{ marginTop: 5 }}>{children}</div>
    </label>
  );
}
export const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
} as const;
export const volume = (n: number) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: 3 }) + " hL";
export function localTime() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}
export type Submit = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<boolean>;
