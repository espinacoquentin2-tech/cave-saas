import { expect, type Page } from "@playwright/test";
import type { MaloWorkspace } from "@/lib/malo-types";
import { getMaloProtocol } from "@/lib/malo-protocols";
export async function openMaloWorkspace(
  page: Page,
  configure?: (data: MaloWorkspace) => void,
  roleKey = "ADMIN",
) {
  const data: MaloWorkspace = {
    items: [
      {
        id: 1,
        name: "Malo recette",
        year: 2026,
        status: "EN_COURS",
        notes: null,
        plannedVolumeHl: 100,
        dosePct: 4,
        protocol: getMaloProtocol("CO_INOCULATION"),
        plannedDestinations: [],
        lots: [],
        events: [],
        schedule: [],
      },
    ],
    sources: [],
    targets: [],
    containers: [
      { id: 13, name: "Bidon disponible", capacityHl: 5, usage: null },
    ],
    products: [
      {
        id: 201,
        name: "Bactéries du stock",
        unit: "kg",
        currentStock: 1,
        subCategory: "Bactéries",
      },
      {
        id: 202,
        name: "Activateur du stock",
        unit: "kg",
        currentStock: 5,
        subCategory: "Activateur",
      },
      {
        id: 203,
        name: "Écorces de levures",
        unit: "kg",
        currentStock: 10,
        subCategory: "Écorces",
      },
    ],
  };
  configure?.(data);
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      json: {
        access_token: "malo-test-token",
        refresh_token: "malo-test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "malo@example.test",
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
    }),
  );
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/me")
      return route.fulfill({
        json: {
          user: { email: "malo@example.test" },
          roleKey,
          organization: { id: 1, slug: "test", name: "Test" },
        },
      });
    if (url.pathname === "/api/malo" && route.request().method() === "GET")
      return route.fulfill({ json: { data } });
    return route.fulfill({
      json:
        route.request().method() === "GET"
          ? []
          : { message: "Mutation non prévue" },
      status: route.request().method() === "GET" ? 200 : 409,
    });
  });
  await page.goto("/app");
  const refuse = page.getByRole("button", {
    name: "Tout refuser",
    exact: true,
  });
  if (await refuse.isVisible()) await refuse.click();
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("malo@example.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /tableau de bord/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Malo$/ }).click();
  await expect(page.getByRole("heading", { name: /Malo$/ })).toBeVisible();
  return data;
}
