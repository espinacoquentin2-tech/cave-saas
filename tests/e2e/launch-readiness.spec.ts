import { expect, test } from "@playwright/test";

// Aucun événement de recette ne doit atteindre le service d'audience réel.
test.beforeEach(async ({ context }) => {
  await context.route("https://plausible.io/api/event", route => route.fulfill({ status: 202, body: "{}" }));
});

test("les moteurs trouvent les pages publiques et excluent l'application", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/legal/confidentialite</loc>");
  expect(xml).not.toContain("/app</loc>");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/app/);
});

test("le partage social a une image et l'application n'est pas indexable", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\//);
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toBeTruthy();
  const imageResponse = await request.get(new URL(image!).pathname);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toContain("image/");
  await page.goto("/app");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("une adresse inconnue propose un retour à l'accueil en français", async ({ page }) => {
  const response = await page.goto("/page-inexistante-recette");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /page introuvable/i })).toBeVisible();
  await page.getByRole("link", { name: /retour à l'accueil/i }).click();
  await expect(page.getByTestId("public-home-page")).toBeVisible();
});

test("le refus de mesure d'audience persiste et peut être modifié", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tout refuser", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Tout refuser", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Préférences cookies", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tout accepter", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tout accepter", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Tout accepter", exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const key = "ma-cuverie:privacy:v1";
    const stored = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...stored, expiresAt: 1 }));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Tout refuser", exact: true })).toBeVisible();
});

test("une adresse email invalide n'est pas envoyée au service d'authentification", async ({ page }) => {
  const authRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/auth/v1/token")) authRequests.push(request.url());
  });
  await page.goto("/app");
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("adresse-invalide");
  await page.getByLabel("Mot de passe", { exact: true }).fill("mot-de-passe-test");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  expect(await page.getByLabel("Adresse e-mail", { exact: true }).evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
  expect(authRequests).toEqual([]);
});

test("effacer le choix dans un autre onglet redemande le consentement", async ({ page, context }) => {
  await context.route("https://plausible.io/api/event", route => route.fulfill({ status: 202, body: "{}" }));
  await page.goto("/");
  await page.getByRole("button", { name: "Tout accepter", exact: true }).click();
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await otherTab.evaluate(() => localStorage.removeItem("ma-cuverie:privacy:v1"));
  await expect(page.getByRole("button", { name: "Tout refuser", exact: true })).toBeVisible();
});

test("les analytics respectent l'accord, le retrait et l'espace connecté", async ({ page }) => {
  test.skip(process.env.E2E_ANALYTICS_ENABLED !== "true", "Activer la configuration analytics sur le serveur de recette.");
  const events: Record<string, unknown>[] = [];
  await page.route("https://plausible.io/api/event", async route => {
    events.push(JSON.parse(route.request().postData()!));
    await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" }, body: "{}" });
  });
  await page.goto("/?email=donnee-privee@example.test#secret");
  await page.getByRole("button", { name: "Tout refuser", exact: true }).click();
  expect(events).toEqual([]);
  await page.getByRole("button", { name: "Préférences cookies", exact: true }).click();
  await page.getByRole("button", { name: "Tout accepter", exact: true }).click();
  await expect.poll(() => events.length).toBe(1);
  expect(events[0].name).toBe("pageview");
  expect(events[0].url).not.toContain("email=");
  expect(events[0].url).not.toContain("#");
  await page.getByRole("button", { name: "Préférences cookies", exact: true }).click();
  await page.getByRole("button", { name: "Tout refuser", exact: true }).click();
  await page.reload();
  expect(events).toHaveLength(1);
  await page.getByRole("button", { name: "Préférences cookies", exact: true }).click();
  await page.getByRole("button", { name: "Tout accepter", exact: true }).click();
  await expect.poll(() => events.length).toBe(2);
  await page.goto("/app");
  await expect(page.getByTestId("login-page")).toBeVisible();
  expect(events).toHaveLength(2);
});
