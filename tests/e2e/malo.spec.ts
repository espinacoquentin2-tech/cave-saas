import { test, expect } from "@playwright/test";
import { openMaloWorkspace } from "./helpers/malo-fixture";
test("dose proposée modifiable, intrants génériques et ajout libre", async ({
  page,
}) => {
  await openMaloWorkspace(page);
  await expect(
    page.getByLabel("Dose proposée (%)", { exact: true }),
  ).toHaveValue("4");
  await page.getByLabel("Dose proposée (%)", { exact: true }).fill("3.5");
  await expect(
    page.getByLabel("Dose proposée (%)", { exact: true }),
  ).toHaveValue("3.5");
  await page.getByRole("button", { name: "Préparation", exact: true }).click();
  await expect(
    page.getByLabel("Produit Bactéries", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Produit Bactéries", { exact: true })
    .selectOption("201");
  await page
    .getByRole("button", { name: "+ Ajouter un produit", exact: true })
    .click();
  await expect(
    page.getByLabel("Produit complémentaire 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Produit complémentaire 1", { exact: true })
    .selectOption("203");
});
test("réponse incertaine conserve la clé et retrouve le dossier", async ({
  page,
}) => {
  const data = await openMaloWorkspace(page);
  let calls = 0,
    key = "";
  await page.route("**/api/malo", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { data } });
    calls++;
    const body = route.request().postDataJSON();
    if (calls === 1) {
      key = body.idempotencyKey;
      data.items[0].events.push({
        id: 99,
        eventType: "CREATION_DOSSIER_MALO",
        eventDatetime: new Date().toISOString(),
        comment: null,
        metadata: { idempotencyKey: key, preparationId: 1 },
      });
      return route.abort("failed");
    }
    expect(body.idempotencyKey).toBe(key);
    return route.fulfill({ status: 409, json: { message: "Déjà enregistré" } });
  });
  await page
    .getByRole("button", { name: "Nouveau dossier", exact: true })
    .click();
  await page
    .getByLabel("Nom de la préparation", { exact: true })
    .fill("Nouvelle");
  await page
    .getByLabel("Cuverie prévue à ensemencer (hL)", { exact: true })
    .fill("100");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await expect(
    page.locator(".malo-workspace").getByRole("alert"),
  ).toContainText("Réponse inconnue");
  await page
    .getByRole("button", {
      name: "Vérifier ou réessayer la même opération",
      exact: true,
    })
    .click();
  await expect(
    page.locator(".malo-workspace").getByRole("status"),
  ).toContainText("résultat retrouvé");
  expect(calls).toBe(2);
});
