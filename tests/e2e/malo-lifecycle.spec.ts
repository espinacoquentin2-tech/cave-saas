import { test, expect } from "@playwright/test";
import { openMaloWorkspace } from "./helpers/malo-fixture";
import type { MaloLotView } from "@/lib/malo-types";
const lot = (
  id: number,
  name: string,
  volumeHl: number,
  role: "MR" | "PCM" | null = null,
): MaloLotView => ({
  id,
  name,
  year: 2026,
  role,
  status: role === "PCM" ? "PCM_EN_DEVELOPPEMENT" : "VIN_DE_BASE",
  volumeHl,
  containerId: id + 100,
  containerName: name,
  capacityHl: 200,
  snapshot: {
    lotId: id,
    volumeHl,
    status: role === "PCM" ? "PCM_EN_DEVELOPPEMENT" : "VIN_DE_BASE",
    compositionEventId: role ? 9 : null,
    lastMutationEventId: 9,
  },
  analyses: [],
  origin: "Taille",
  homogenized: true,
});
test("distribution multi-cuves, calcul avant ajout et historique", async ({
  page,
}) => {
  const data = await openMaloWorkspace(page, (d) => {
    const pcm = lot(10, "PCM", 26.25, "PCM");
    const initial = {
        id: 30,
        lotId: 10,
        analysisDate: "2026-10-01T08:00:00Z",
        ph: null,
        at: null,
        so2Free: null,
        so2Total: null,
        alcohol: null,
        extraData: { malique: 6 },
      },
      current = {
        ...initial,
        id: 31,
        analysisDate: "2026-10-07T08:00:00Z",
        extraData: { malique: 2 },
      };
    pcm.control = {
      consumptionPct: (100 * 2) / 3,
      criterionReached: true,
      reason: null,
      initial,
      current,
      representative: true,
    };
    d.items[0].lots = [pcm];
    d.targets = [lot(20, "Cuve A", 100), lot(21, "Cuve B", 50)];
    d.sources = d.targets;
  });
  let count = 0;
  await page.route("**/api/malo/1/distribute", (route) => {
    count++;
    const body = route.request().postDataJSON();
    expect(body.initialAnalysisId).toBe(30);
    expect(body.currentAnalysisId).toBe(31);
    expect(
      body.destinations.map((x: { volumeHl: number }) => x.volumeHl),
    ).toEqual([4, 1.75]);
    data.items[0].lots[0].volumeHl -= 5.75;
    data.items[0].events.push({
      id: 40,
      eventType: "ENSEMENCEMENT_MALO",
      eventDatetime: new Date().toISOString(),
      comment: null,
      metadata: {
        operation: "ENSEMENCEMENT_MALO",
        preparationId: 1,
        idempotencyKey: body.idempotencyKey,
        pcmName: "PCM",
        volumeHl: 5.75,
        destinations: body.destinations,
      },
    });
    return route.fulfill({
      json: { status: "SUCCESS", data: { eventId: 40, preparationId: 1 } },
    });
  });
  await page.getByRole("button", { name: "Distribution", exact: true }).click();
  await page.getByLabel("Ensemencer Cuve A", { exact: true }).check();
  await page.getByLabel("Ensemencer Cuve B", { exact: true }).check();
  await expect(
    page.getByLabel("Volume PCM Cuve A (hL)", { exact: true }),
  ).toHaveValue("4");
  await page.getByLabel("Dose Cuve B (%)", { exact: true }).fill("3.5");
  await expect(
    page.getByLabel("Volume PCM Cuve B (hL)", { exact: true }),
  ).toHaveValue("1.75");
  expect(count).toBe(0);
  await page.getByLabel(/Je confirme/).check();
  await page
    .getByRole("button", { name: "Valider l’ensemencement", exact: true })
    .click();
  await expect(
    page.locator(".malo-workspace").getByRole("status"),
  ).toContainText("enregistrée");
  expect(count).toBe(1);
  await page.getByRole("button", { name: "Historique", exact: true }).click();
  await expect(
    page.getByText("ENSEMENCEMENT MALO", { exact: true }),
  ).toBeVisible();
});
test("lecture seule permet de consulter sans préparation", async ({ page }) => {
  await openMaloWorkspace(page, undefined, "LECTURE_SEULE");
  await expect(
    page.getByRole("button", { name: "Nouveau dossier", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Préparation", exact: true }).click();
  await expect(
    page.getByLabel("Produit Bactéries", { exact: true }),
  ).toBeDisabled();
});

test("analyse Malo : prélèvement précis, contexte conservé et mesure à zéro", async ({
  page,
}) => {
  await openMaloWorkspace(page, (d) => {
    d.items[0].lots = [lot(10, "PCM", 26.25, "PCM")];
  });
  let saved = false;
  await page.route("**/api/analyses", (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    const body = route.request().postDataJSON(),
      a = body.analyses[0];
    expect(a.extraData.malo.compositionEventId).toBe(9);
    expect(a.extraData.malo.containerId).toBe(110);
    expect(a.extraData.malo.sampledAt).toBe(a.analysisDate);
    expect(a.extraData.malique).toBe(0);
    expect(a.so2Free).toBe(0);
    saved = true;
    return route.fulfill({ json: { status: "SUCCESS", count: 1 } });
  });
  await page.getByRole("button", { name: "Contrôles", exact: true }).click();
  await page
    .getByRole("button", { name: "Ajouter une analyse PCM", exact: true })
    .click();
  const sample = page.getByLabel("Date et heure du prélèvement", {
    exact: true,
  });
  await expect(sample).toHaveAttribute("step", "0.001");
  await expect(sample).toHaveValue(/T\d\d:\d\d:\d\d\.\d{3}$/);
  await page.getByLabel("Acide malique", { exact: true }).fill("0");
  await page.getByLabel("SO₂ libre", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analyse du PCM", exact: true }),
  ).toHaveCount(0);
  expect(saved).toBe(true);
});
