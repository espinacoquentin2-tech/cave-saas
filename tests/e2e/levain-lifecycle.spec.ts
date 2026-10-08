import { test, expect } from "@playwright/test";
import { openLevainWorkspace as open } from "./helpers/levain-fixture";
test("préparation explicite avec protocole et refus sans faux succès", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Préparation", exact: true }).click();
  await page
    .getByLabel("Vin source du levain", { exact: true })
    .selectOption("11");
  await page.getByLabel("Vin introduit (hL)", { exact: true }).fill("2");
  await page
    .getByLabel("Capacité nouvelle cuve (hL)", { exact: true })
    .fill("5");
  await page
    .getByLabel("Référence du protocole", { exact: true })
    .fill("Protocole cave");
  await page
    .getByLabel("Protocole retenu", { exact: true })
    .fill("Préparation enregistrée par le caviste");
  await page.getByLabel("Étape réalisée", { exact: true }).fill("Introduction");
  await page
    .getByRole("button", { name: "Enregistrer la préparation", exact: true })
    .click();
  await expect(
    page.locator(".levain-workspace").getByRole("alert"),
  ).toContainText("Stock insuffisant");
  await expect(
    page.locator(".levain-workspace").getByRole("status"),
  ).not.toContainText("enregistrée");
});
for (const mode of ["PREPARED", "MAKE"])
  test(`nourrissage ${mode} avec DAP 20 g/hL et paramètres explicites`, async ({
    page,
  }) => {
    const data = await open(page);
    let calls = 0;
    await page.route("**/api/levains/feed", async (route) => {
      const body = route.request().postDataJSON();
      calls++;
      expect(body.liqueur.mode).toBe(mode);
      expect(body.dapProductId).toBe(203);
      expect(body.snapshot.status).toBe("LEVAIN_PRET");
      expect(body).not.toHaveProperty("wineVolumeHl");
      data.items[0].volumeHl = 4;
      data.items[0].state = "LEVAIN_EN_PROPAGATION";
      data.items[0].status = "LEVAIN_EN_PROPAGATION";
      await route.fulfill({ json: { data: { eventId: 30 } } });
    });
    await page
      .getByRole("button", { name: "Nourrissage", exact: true })
      .click();
    await page
      .getByLabel("Mode de liqueur", { exact: true })
      .selectOption(mode);
    if (mode === "PREPARED")
      await page
        .getByLabel("Produit liqueur", { exact: true })
        .selectOption("204");
    else {
      await page
        .getByLabel("Produit sucre", { exact: true })
        .selectOption("202");
      await page
        .getByLabel("Vin de dissolution", { exact: true })
        .selectOption("101");
    }
    await page.getByLabel("Vin nourricier", { exact: true }).selectOption("11");
    await page.getByLabel("Produit DAP", { exact: true }).selectOption("203");
    await page.getByLabel("Volume visé (hL)", { exact: true }).fill("4");
    await page.getByLabel("TAV vin nourricier (%)", { exact: true }).fill("13");
    await expect(page.getByText(/Recette :.*DAP 0[,.]08 kg/)).toBeVisible();
    await page
      .getByRole("button", { name: "Valider le nourrissage", exact: true })
      .click();
    await expect(
      page.locator(".levain-workspace").getByRole("status"),
    ).toContainText("enregistrée");
    expect(calls).toBe(1);
    await page.route("**/api/levains/qualify", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.snapshot.status).toBe("LEVAIN_EN_PROPAGATION");
      expect(body.missingMeasurementsReason).toBe(
        "Analyses indisponibles pour cet essai",
      );
      expect(body).not.toHaveProperty("products");
      data.items[0].status = "LEVAIN_PRET";
      data.items[0].state = "LEVAIN_PRET";
      await route.fulfill({ json: { data: { eventId: 31 } } });
    });
    await page.getByRole("button", { name: "Contrôles", exact: true }).click();
    await page
      .getByLabel("Motif des mesures indisponibles", { exact: true })
      .fill("Analyses indisponibles pour cet essai");
    await page
      .getByLabel(
        "Je confirme le protocole réalisé et la disponibilité du levain.",
        { exact: true },
      )
      .check();
    await page
      .getByRole("button", { name: "Qualifier le levain", exact: true })
      .click();
    await expect(
      page
        .locator(".levain-workspace p")
        .filter({ hasText: "4 hL — Prêt au tirage" }),
    ).toBeVisible();
  });
test("un levain historique est repris explicitement sans nouvel apport de LSA", async ({
  page,
}) => {
  const data = await open(page, (data) => {
    data.items[0].state = "A_QUALIFIER";
    data.items[0].status = "ACTIF";
  });
  await page.route("**/api/levains/qualify", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.legacyResume).toBe(true);
    expect(body.protocol.reference).toBe("Protocole historique");
    expect(body).not.toHaveProperty("products");
    data.items[0].state = "LEVAIN_PRET";
    data.items[0].status = "LEVAIN_PRET";
    await route.fulfill({ json: { data: { eventId: 32 } } });
  });
  await page.getByRole("button", { name: "Contrôles", exact: true }).click();
  await page
    .getByLabel("Référence du protocole historique", { exact: true })
    .fill("Protocole historique");
  await page
    .getByLabel("Préparation historique réalisée", { exact: true })
    .fill("LSA introduites lors de la préparation historique");
  await page
    .getByLabel("Motif des mesures indisponibles", { exact: true })
    .fill("Analyses conservées dans le registre papier");
  await page
    .getByLabel(
      "Je confirme le protocole réalisé et la disponibilité du levain.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Qualifier le levain", exact: true })
    .click();
  await expect(
    page
      .locator(".levain-workspace p")
      .filter({ hasText: "2 hL — Prêt au tirage" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /tableau de bord/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /planif\. tirage/i }).click();
  await page.getByRole("button", { name: "Contrôles", exact: true }).click();
  await expect(
    page
      .locator(".levain-workspace p")
      .filter({ hasText: "2 hL — Prêt au tirage" }),
  ).toBeVisible();
});
test("une étape LSA seule fonctionne sans vin disponible", async ({ page }) => {
  await open(page, (data) => {
    data.items[0].state = "LEVAIN_EN_PREPARATION";
    data.items[0].status = "LEVAIN_EN_PREPARATION";
    data.wines = [];
  });
  let calls = 0;
  await page.route("**/api/levains/preparation", async (route) => {
    const body = route.request().postDataJSON();
    calls++;
    expect(body.volumeHl).toBe(0);
    expect(body).not.toHaveProperty("sourceContainerId");
    expect(body.products[0].kind).toBe("LSA");
    await route.fulfill({ json: { data: { eventId: 24 } } });
  });
  await page.getByRole("button", { name: "Préparation", exact: true }).click();
  await page
    .getByLabel("Préparation à enregistrer", { exact: true })
    .selectOption("102");
  await page.getByLabel("Vin introduit (hL)", { exact: true }).fill("0");
  await page.getByLabel("Produit LSA", { exact: true }).selectOption("201");
  await page.getByLabel("LSA introduites (kg)", { exact: true }).fill("0.1");
  await page
    .getByLabel("Étape réalisée", { exact: true })
    .fill("Introduction des LSA");
  await page
    .getByRole("button", { name: "Enregistrer la préparation", exact: true })
    .click();
  await expect(
    page.locator(".levain-workspace").getByRole("status"),
  ).toContainText("enregistrée");
  expect(calls).toBe(1);
});
test("planning civil et formulaire utilisables sur mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Levains et tirage", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Préparation", exact: true }).click();
  await expect(
    page.getByLabel("Référence du protocole", { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".levain-workspace")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBeTruthy();
});

test("parcours complet préparation, qualification, mixtion, contrôle et tirage", async ({
  page,
}) => {
  const data = await open(page);
  let count = 0;
  data.products.push(
    ...[
      ["301", "Bouteilles"],
      ["302", "Capsules"],
      ["303", "Bidules"],
    ].map(([id, name]) => ({
      id: Number(id),
      name,
      category: "Matieres seches",
      subCategory: name,
      unit: "unites",
      currentStock: 1000,
    })),
  );
  await page.route("**/api/levains", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { data } });
    const b = route.request().postDataJSON();
    expect(b.protocol.reference).toBe("Essai cave");
    expect(b.products[0].kind).toBe("LSA");
    data.items.unshift({
      lotId: 103,
      name: "Levain préparé",
      containerId: 14,
      containerName: "Levain créé",
      status: "LEVAIN_EN_PREPARATION",
      state: "LEVAIN_EN_PREPARATION",
      volumeHl: 2,
      capacityHl: 5,
      lastMutationEventId: 23,
      events: [],
      analyses: [],
    });
    await route.fulfill({ json: { data: { eventId: 23 } } });
  });
  await page.route("**/api/levains/qualify", async (route) => {
    const b = route.request().postDataJSON();
    expect(b.snapshot.lotId).toBe(103);
    expect(b.protocolCompleted).toBe(true);
    data.items[0].state = "LEVAIN_PRET";
    data.items[0].status = "LEVAIN_PRET";
    data.items[0].lastMutationEventId = 24;
    await route.fulfill({ json: { data: { eventId: 24 } } });
  });
  await page.route("**/api/tirage/mixtions", async (route) => {
    expect(route.request().postDataJSON().snapshot.lotId).toBe(103);
    data.mixtions.push({
      lotId: 104,
      name: "Mixtion recette",
      containerId: 13,
      containerName: "Mixtion",
      status: "ASSEMBLE",
      state: null,
      volumeHl: 2.23,
      capacityHl: 20,
      lastMutationEventId: 25,
      creationEventId: 25,
      checked: false,
      events: [],
      analyses: [],
    });
    data.items[0].volumeHl = 1.8;
    await route.fulfill({ json: { data: { eventId: 25 } } });
  });
  await page.route("**/api/tirage/mixtions/check", async (route) => {
    expect(route.request().postDataJSON().operatorConfirmed).toBe(true);
    data.mixtions[0].checked = true;
    await route.fulfill({ json: { data: { eventId: 26 } } });
  });
  await page.route("**/api/tirage", async (route) => {
    const b = route.request().postDataJSON();
    count++;
    expect(b.lotId).toBe(104);
    expect(b.count).toBe(297);
    expect(
      b.stockItems.every((p: { kind: string }) =>
        p.kind.startsWith("PACKAGING_"),
      ),
    ).toBe(true);
    data.mixtions[0].volumeHl = 0.0025;
    await route.fulfill({ json: { data: { bottleLotId: 105 } } });
  });
  await page.getByRole("button", { name: "Préparation", exact: true }).click();
  await page
    .getByLabel("Vin source du levain", { exact: true })
    .selectOption("11");
  await page
    .getByLabel("Référence du protocole", { exact: true })
    .fill("Essai cave");
  await page
    .getByLabel("Protocole retenu", { exact: true })
    .fill("Étapes du protocole cave");
  await page
    .getByLabel("Étape réalisée", { exact: true })
    .fill("Introduction des LSA");
  await page.getByLabel("Produit LSA", { exact: true }).selectOption("201");
  await page.getByLabel("LSA introduites (kg)", { exact: true }).fill(".1");
  await page
    .getByRole("button", { name: "Enregistrer la préparation", exact: true })
    .click();
  await expect(
    page.locator(".levain-workspace").getByRole("status"),
  ).toContainText("enregistrée");
  await page.getByRole("button", { name: "Contrôles", exact: true }).click();
  await page
    .getByLabel("Levain à contrôler", { exact: true })
    .selectOption("103");
  for (const [label, value] of [
    ["Température mesurée (°C)", "16"],
    ["Masse volumique corrigée à 20 °C", "998"],
    ["TAV mesuré (%)", "12"],
    ["Sucres résiduels mesurés (g/L GF)", "20"],
    ["pH mesuré", "3.1"],
    ["Population (millions de cellules/mL)", "60"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel(
      "Je confirme le protocole réalisé et la disponibilité du levain.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Qualifier le levain", exact: true })
    .click();
  await expect(
    page.locator(".levain-workspace p").filter({ hasText: "Prêt au tirage" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mixtion et tirage", exact: true })
    .click();
  await page
    .getByLabel("Vin de la mixtion", { exact: true })
    .selectOption("101");
  await page.getByLabel("Levain qualifié", { exact: true }).selectOption("103");
  await page.getByLabel("Cuve de mixtion", { exact: true }).selectOption("13");
  await page
    .getByLabel("Sucre de mixtion", { exact: true })
    .selectOption("202");
  await page
    .getByRole("button", { name: "Enregistrer la mixtion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Mixtion recette/ }),
  ).toBeVisible();
  await page
    .getByLabel("Masse volumique vin à 20 °C", { exact: true })
    .fill("991.6");
  await page
    .getByLabel("Masse volumique mixtion à 20 °C", { exact: true })
    .fill("1001.4");
  await page
    .getByLabel("Je confirme le point de tirage après homogénéisation.", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: "Enregistrer le point de tirage",
      exact: true,
    })
    .click();
  await page.getByLabel("Bouteilles", { exact: true }).selectOption("301");
  await page
    .getByLabel("Fermeture principale", { exact: true })
    .selectOption("302");
  await page
    .getByLabel("Fermeture secondaire", { exact: true })
    .selectOption("303");
  await page
    .getByRole("button", {
      name: "Enregistrer la mise en bouteilles",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: /Mixtion recette.*0.0025/ }),
  ).toBeVisible();
  expect(count).toBe(1);
});
