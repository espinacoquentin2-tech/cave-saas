import { test, expect } from "@playwright/test";
import { openLevainWorkspace } from "./helpers/levain-fixture";
for (const failure of ["réseau", "erreur serveur"])
  test(`une réponse incertaine (${failure}) conserve la clé et retrouve le mouvement sans double débit`, async ({
    page,
  }) => {
    const data = await openLevainWorkspace(page);
    let calls = 0,
      key = "";
    await page.route("**/api/levains", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { data } });
      calls++;
      const body = route.request().postDataJSON();
      if (calls === 1) {
        key = body.idempotencyKey;
        data.items[0].events.push({
          id: 33,
          eventType: "CREATION_LEVAIN",
          eventDatetime: new Date().toISOString(),
          metadata: { idempotencyKey: key },
        });
        if (failure === "réseau") await route.abort("failed");
        else
          await route.fulfill({
            status: 500,
            json: { message: "Réponse incertaine" },
          });
      } else {
        expect(body.idempotencyKey).toBe(key);
        await route.fulfill({
          status: 409,
          json: { message: "Cette opération a déjà été enregistrée." },
        });
      }
    });
    await page
      .getByRole("button", { name: "Préparation", exact: true })
      .click();
    await page
      .getByLabel("Vin source du levain", { exact: true })
      .selectOption("11");
    await page
      .getByLabel("Référence du protocole", { exact: true })
      .fill("Cave");
    await page
      .getByLabel("Protocole retenu", { exact: true })
      .fill("Étapes réalisées");
    await page.getByLabel("Étape réalisée", { exact: true }).fill("Départ");
    await page
      .getByRole("button", { name: "Enregistrer la préparation", exact: true })
      .click();
    await expect(
      page.locator(".levain-workspace").getByRole("alert"),
    ).toContainText("Réponse inconnue");
    await expect(
      page.getByLabel("Vin introduit (hL)", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Vérifier ou réessayer la même opération",
        exact: true,
      })
      .click();
    await expect(
      page.locator(".levain-workspace").getByRole("status"),
    ).toContainText("résultat retrouvé");
    expect(calls).toBe(2);
  });
