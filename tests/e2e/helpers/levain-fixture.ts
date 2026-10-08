import { test, expect, type Page } from "@playwright/test";
import type { LevainData, LotView } from "@/components/modules/levains/types";
export async function openLevainWorkspace(
  page: Page,
  configure?: (data: LevainData) => void,
) {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    "Compte E2E requis.",
  );
  await page.route("**/api/**", (route) =>
    route.request().method() === "GET"
      ? route.continue()
      : route.fulfill({
          status: 409,
          json: { message: "Mutation de recette non prévue." },
        }),
  );
  const source = {
    lotId: 101,
    name: "Vin source",
    containerId: 11,
    containerName: "Vin source",
    status: "VIN_DE_BASE",
    state: null,
    volumeHl: 10,
    capacityHl: 20,
    lastMutationEventId: null,
    events: [],
    analyses: [],
  };
  const ready: LotView = {
    lotId: 102,
    name: "Levain recette",
    containerId: 12,
    containerName: "Cuve levain",
    status: "LEVAIN_PRET",
    state: "LEVAIN_PRET",
    volumeHl: 2,
    capacityHl: 10,
    lastMutationEventId: 22,
    events: [],
    analyses: [],
  };
  const data: LevainData = {
    items: [ready],
    wines: [source],
    mixtions: [],
    emptyTanks: [{ id: 13, name: "Cuve vide", capacityHl: 20 }],
    products: [
      {
        id: 201,
        name: "LSA",
        category: "Intrants",
        subCategory: "Levures",
        unit: "kg",
        currentStock: 10,
      },
      {
        id: 202,
        name: "Sucre",
        category: "Intrants",
        subCategory: "Sucres",
        unit: "kg",
        currentStock: 100,
      },
      {
        id: 203,
        name: "DAP",
        category: "Intrants",
        subCategory: "DAP",
        unit: "kg",
        currentStock: 10,
      },
      {
        id: 204,
        name: "Liqueur",
        category: "Intrants",
        subCategory: "Liqueur",
        unit: "L",
        currentStock: 100,
      },
    ],
  };
  configure?.(data);
  await page.route("**/api/levains", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { data } })
      : route.fulfill({
          status: 409,
          json: { message: "Stock insuffisant pour cette recette." },
        }),
  );
  await page.goto("/app");
  const refuse = page.getByRole("button", {
    name: "Tout refuser",
    exact: true,
  });
  if (await refuse.isVisible()) await refuse.click();
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill(process.env.E2E_ADMIN_EMAIL!);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /tableau de bord/i }),
  ).toBeVisible();
  const nav = page.getByRole("button", {
    name: "Ouvrir la navigation",
    exact: true,
  });
  if (await nav.isVisible()) await nav.click();
  await page.getByRole("button", { name: /planif\. tirage/i }).click();
  return data;
}
