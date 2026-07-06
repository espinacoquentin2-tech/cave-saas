"use client";

import { normalizeTirageBouchage } from "@/lib/tirage";

let latestAccessToken: string | undefined;

export const setLatestAccessToken = (token: string | undefined) => {
  latestAccessToken = token;
};

export const unwrapApiData = (payload: any) => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
};

export const extractApiErrorMessage = (payload: any, fallback = "Erreur serveur") => {
  const fieldErrorEntry = payload?.details?.fieldErrors
    ? Object.entries(payload.details.fieldErrors).find(([, messages]) => Array.isArray(messages) && messages.find(Boolean))
    : null;
  const fieldError = fieldErrorEntry
    ? `${fieldErrorEntry[0]}: ${(fieldErrorEntry[1] as any[]).find(Boolean)}`
    : null;
  const formError = Array.isArray(payload?.details?.formErrors)
    ? payload.details.formErrors.find(Boolean)
    : null;

  return fieldError || formError || payload?.message || payload?.error || fallback;
};

export const buildApiHeaders = (
  user: { accessToken?: string; organizationId?: string | number; organizationSlug?: string } | null | undefined,
  extra: Record<string, string> = {},
) => ({
  "Content-Type": "application/json",
  "x-request-id": crypto.randomUUID(),
  ...((user?.accessToken ?? latestAccessToken) ? { Authorization: `Bearer ${user?.accessToken ?? latestAccessToken}` } : {}),
  ...(user?.organizationId ? { "x-organization-id": String(user.organizationId) } : {}),
  ...(user?.organizationSlug && !user?.organizationId ? { "x-organization-slug": user.organizationSlug } : {}),
  ...extra,
});

export const toSafeNumber = (value: any) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getLotCode = (lot: any) => lot?.businessCode || lot?.code || `Lot #${lot?.id ?? "?"}`;

export const resolveTiragePackagingProducts = (products: any[], formatCode: string, bouchageValue: string) => {
  const bouchage = normalizeTirageBouchage(bouchageValue);
  const formatToken = formatCode.toLowerCase();

  const bottleProduct = products.find((product: any) => {
    if (product.subCategory !== "Bouteilles") return false;
    return (product.name || "").toLowerCase().includes(formatToken);
  });

  const primaryClosureProduct = products.find((product: any) => {
    if (bouchage === "CAPSULE") return product.subCategory === "Capsules";
    return product.subCategory === "Bouchons";
  });

  const secondaryClosureProduct = products.find((product: any) => {
    if (bouchage === "CAPSULE") return product.subCategory === "Bidules";
    return product.subCategory === "Agrafes";
  });

  return {
    bottleProduct,
    primaryClosureProduct,
    secondaryClosureProduct,
    bouchage,
  };
};

export const buildTirageStockItems = (products: any[], formatCode: string, bouchageValue: string, count: number) => {
  const { bottleProduct, primaryClosureProduct, secondaryClosureProduct, bouchage } =
    resolveTiragePackagingProducts(products, formatCode, bouchageValue);

  const items = [
    bottleProduct
      ? {
          kind: "PACKAGING_BOTTLE",
          productId: bottleProduct.id,
          quantity: count,
          unit: bottleProduct.unit,
          label: `Bouteilles ${formatCode}`,
        }
      : null,
    primaryClosureProduct
      ? {
          kind: "PACKAGING_PRIMARY_CLOSURE",
          productId: primaryClosureProduct.id,
          quantity: count,
          unit: primaryClosureProduct.unit,
          label: bouchage === "CAPSULE" ? "Capsules tirage" : "Bouchons liege tirage",
        }
      : null,
    secondaryClosureProduct
      ? {
          kind: "PACKAGING_SECONDARY_CLOSURE",
          productId: secondaryClosureProduct.id,
          quantity: count,
          unit: secondaryClosureProduct.unit,
          label: bouchage === "CAPSULE" ? "Bidules" : "Agrafes tirage",
        }
      : null,
  ].filter(Boolean);

  const missing = [
    bottleProduct ? null : `Bouteilles ${formatCode}`,
    primaryClosureProduct ? null : bouchage === "CAPSULE" ? "Capsules" : "Bouchons",
    secondaryClosureProduct ? null : bouchage === "CAPSULE" ? "Bidules" : "Agrafes",
  ].filter(Boolean);

  return {
    items,
    missing,
    bottleProduct,
    primaryClosureProduct,
    secondaryClosureProduct,
  };
};
