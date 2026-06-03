import { expect, type Locator, type Page, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

const criticalConsolePatterns = [
  /uncaught/i,
  /typeerror/i,
  /referenceerror/i,
  /hydration/i,
  /minified react error/i,
  /next\.js.+error/i,
];

const benignConsolePatterns = [
  /401/,
  /\/api\/mixtion\/execute.*410/,
  /failed to load resource/i,
];

test.describe("Smoke UI V1 isolé", () => {
  test("ouvre les modules V1 sans mutation métier", async ({ page }) => {
    test.skip(!email, "E2E_ADMIN_EMAIL est requis pour le smoke UI V1.");
    test.skip(!password, "E2E_ADMIN_PASSWORD est requis pour le smoke UI V1.");

    const issues = collectRuntimeIssues(page);

    await page.goto("/");
    await loginIfNeeded(page, email!, password!);
    await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
    await assertNoBlockingUiError(page);

    await smokeDashboard(page);
    await smokeCuverie(page);
    await smokeLots(page);
    await smokeAssemblages(page);
    await smokeTirage(page);
    await smokeWorkOrders(page);
    await smokeStockBouteilles(page);
    await smokeExpeditions(page);
    await smokeTracabilite(page);
    await smokeStocks(page);
    await smokeAdministratif(page);
    await smokeDegustationAnalysesMaturation(page);

    expect(issues(), "Erreurs runtime critiques détectées").toEqual([]);
  });
});

function collectRuntimeIssues(page: Page) {
  const issues: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (benignConsolePatterns.some((pattern) => pattern.test(text))) return;
    if (criticalConsolePatterns.some((pattern) => pattern.test(text))) {
      issues.push(`console error: ${text}`);
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 500) issues.push(`HTTP ${status}: ${url}`);
  });

  page.on("pageerror", (error) => {
    issues.push(`page error: ${error.message}`);
  });

  return () => issues;
}

async function loginIfNeeded(page: Page, userEmail: string, userPassword: string) {
  const dashboard = page.getByRole("heading", { name: /tableau de bord/i });
  const loginButton = page.getByRole("button", { name: /se connecter/i });

  await Promise.race([
    dashboard.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined),
    loginButton.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined),
  ]);

  if (await dashboard.isVisible().catch(() => false)) return;

  await expect(loginButton, "Écran login introuvable et dashboard absent.").toBeVisible();
  await page.getByPlaceholder("vous@domaine.fr").fill(userEmail);
  await page.locator('input[type="password"]').fill(userPassword);
  await loginButton.click();

  await expect(
    dashboard,
    "Login impossible avec E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD ou dashboard non chargé.",
  ).toBeVisible({ timeout: 30_000 });
}

async function go(page: Page, buttonName: RegExp, headingName: RegExp) {
  await page.getByRole("button", { name: buttonName }).first().click();
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible();
  await assertNoBlockingUiError(page);
}

async function assertNoBlockingUiError(page: Page) {
  await expect(page.locator("body")).not.toContainText(/invalid date/i);
  await expect(page.locator("body")).not.toContainText(/hydration failed|text content does not match|Unhandled Runtime Error/i);
  await expect(page.locator("nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-toast]")).toHaveCount(0);
}

async function expectAnyVisible(page: Page, patterns: RegExp[]) {
  const locators = patterns.map((pattern) => page.getByText(pattern).first());
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) return;
  }
  throw new Error(`Aucun élément stable visible parmi: ${patterns.map(String).join(", ")}`);
}

async function clickIfUsable(locator: Locator) {
  if (!(await locator.count())) return false;
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  if (!(await first.isEnabled().catch(() => false))) return false;
  await first.click();
  return true;
}

async function closeModal(page: Page) {
  const closeButton = page.getByRole("button", { name: /annuler|fermer|x|×/i }).last();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(page.locator('[style*="position: fixed"]')).toHaveCount(0, { timeout: 10_000 }).catch(() => undefined);
}

async function smokeDashboard(page: Page) {
  await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  await expectAnyVisible(page, [/volume en cave/i, /lots actifs/i, /contenants actifs/i, /sur lattes/i]);
  const reset = page.getByText(/reset base de test/i);
  if (await reset.isVisible().catch(() => false)) {
    await expect(reset).toBeVisible();
  }
}

async function smokeCuverie(page: Page) {
  await go(page, /cuverie/i, /cuverie/i);
  await expect(page.getByPlaceholder(/rechercher un contenant/i)).toBeVisible();
  await expectAnyVisible(page, [/contenants pleins|contenants vides|aucun contenant/i]);
  await expect(page.locator("body")).not.toContainText(/supprimer définitivement|irréversible/i);
  const archiveButton = page.getByRole("button", { name: /archive/i });
  if (await archiveButton.count()) {
    await expect(page.getByText(/archivage à venir/i).first()).toBeVisible();
  }
}

async function smokeLots(page: Page) {
  await go(page, /^lots/i, /^lots$/i);
  await expect(page.getByPlaceholder(/recherche code/i)).toBeVisible();
  await expectAnyVisible(page, [/code lot/i, /aucun lot dans cette section/i]);

  const firstLotCell = page.locator("text=/^[A-Z0-9][A-Z0-9_-]{2,}/").first();
  if (await firstLotCell.isVisible().catch(() => false)) {
    await firstLotCell.click();
    await expectAnyVisible(page, [/timeline|historique|analyses|traçabilité|fiche/i]);
    await page.getByRole("button", { name: /retour|←|back/i }).first().click().catch(async () => {
      await go(page, /^lots/i, /^lots$/i);
    });
  }
}

async function smokeAssemblages(page: Page) {
  await go(page, /assemblages/i, /assemblages/i);
  await expectAnyVisible(page, [/créer un assemblage|sources principales|aucune source/i]);
  if (await clickIfUsable(page.getByRole("button", { name: /créer un assemblage/i }))) {
    await expect(page.getByText(/type d'assemblage souhaité/i)).toBeVisible();
    await closeModal(page);
  }
}

async function smokeTirage(page: Page) {
  await go(page, /planif\. tirage/i, /préparation & tirage/i);
  await expectAnyVisible(page, [/source|format|pression|simulation mixtion|planning & stocks/i]);
  await expect(page.locator("body")).not.toContainText(/supprimer|détruire|reset/i);
}

async function smokeWorkOrders(page: Page) {
  await go(page, /ordres de travail/i, /ordres de travail/i);
  await expectAnyVisible(page, [/liste|type|soutirage|transvasement|intrant|tirage|assemblage|aucun/i]);
  if (await clickIfUsable(page.getByRole("button", { name: /nouvel|créer|ajouter/i }))) {
    await expectAnyVisible(page, [/soutirage|transvasement|intrant|tirage|assemblage/i]);
    await closeModal(page);
  }
}

async function smokeStockBouteilles(page: Page) {
  await go(page, /^cave$/i, /stock bouteilles/i);
  for (const tab of [/vieillissement/i, /à habiller/i, /prêts/i, /vins de réserve/i]) {
    await page.getByRole("button", { name: tab }).click();
    await assertNoBlockingUiError(page);
  }
  for (const action of [/dégorger/i, /habiller/i, /expédier/i]) {
    if (await clickIfUsable(page.getByRole("button", { name: action }))) {
      await closeModal(page);
    }
  }
}

async function smokeExpeditions(page: Page) {
  await go(page, /expéditions/i, /expéditions/i);
  for (const tab of [/bouteilles/i, /vrac/i, /distillerie/i]) {
    await page.getByRole("button", { name: tab }).click();
    await assertNoBlockingUiError(page);
  }

  await page.getByRole("button", { name: /vrac/i }).click();
  await expectAnyVisible(page, [/expéditions vrac|vrac \/ citerne|aucune expédition vrac|lot|volume/i]);
  await expect(page.locator("body")).not.toContainText(/contenants vides ou en nettoyage|cuverie/i);

  if (await clickIfUsable(page.getByRole("button", { name: /\+ nouvel envoi/i }).first())) {
    await expectAnyVisible(page, [/nouvel envoi/i, /client|transporteur|lot/i]);
    await closeModal(page);
  }
}

async function smokeTracabilite(page: Page) {
  await go(page, /traçabilité/i, /graphe de traçabilité/i);
  await expectAnyVisible(page, [/point d'entrée|recherche|lot|parcelle/i]);
}

async function smokeStocks(page: Page) {
  await go(page, /matières sèches/i, /inventaire & matières/i);
  await expectAnyVisible(page, [/inventaire|mouvements|produit|stock/i]);
  await page.getByRole("button", { name: /mouvements/i }).click();
  await assertNoBlockingUiError(page);
  if (await clickIfUsable(page.getByRole("button", { name: /nouveau produit/i }))) {
    await closeModal(page);
  }
  if (await clickIfUsable(page.getByRole("button", { name: /mouvement/i }))) {
    await closeModal(page);
  }
}

async function smokeAdministratif(page: Page) {
  await go(page, /administratif/i, /administratif|documents/i);
  await expectAnyVisible(page, [/pressoir|drm|distillerie|exporter/i]);

  await page.getByText(/administration/i).click();
  await page.getByRole("button", { name: /utilisateurs/i }).click();
  await expect(page.getByRole("heading", { name: /utilisateurs/i })).toBeVisible();
  await expectAnyVisible(page, [/email|role|rôle|admin|caviste|lecture seule/i]);

  await page.getByText(/administration/i).click();
  await page.getByRole("button", { name: /journal/i }).click();
  await expectAnyVisible(page, [/journal|audit|logs|événements/i]);
}

async function smokeDegustationAnalysesMaturation(page: Page) {
  await go(page, /dégustation/i, /dégustation/i);
  await expectAnyVisible(page, [/nouvelle dégustation|lot|phase|aucune/i]);
  if (await clickIfUsable(page.getByRole("button", { name: /nouvelle dégustation/i }))) {
    await closeModal(page);
  }

  await go(page, /analyses/i, /analyses/i);
  await expectAnyVisible(page, [/analyse|ph|so2|aucune/i]);

  await go(page, /maturation/i, /maturation/i);
  await expectAnyVisible(page, [/nouveau prélèvement|parcelle|suivi/i]);
  if (await clickIfUsable(page.getByRole("button", { name: /nouveau prélèvement/i }))) {
    await closeModal(page);
  }
}
