import { expect, test, type Page } from '@playwright/test';

// La base réelle est couverte par test:levains. Ici, une API de recette teste
// les requêtes de l'interface et sa relecture des données sans mutation distante.
async function setup(page: Page, hasLevain: boolean) {
  let sourceVolume = 10;
  let levainVolume = hasLevain ? 2 : 0;
  const sourceId = 200001;
  const levainId = 200002;
  await page.route('**/api/**', route => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 409, json: { message: 'Mutation de recette non prévue.' } }));
  await page.route('**/api/containers?*', route => route.fulfill({ json: [
    { id: sourceId, code: 'RECETTE-SOURCE', displayName: 'Vin source recette', type: 'CUVE_INOX', capacityValue: 20, zone: 'Cuverie', status: 'PLEIN', currentLots: [{ id: 300001, businessCode: 'RECETTE-BASE', currentVolume: sourceVolume, status: 'VIN_DE_BASE' }] },
    ...(levainVolume > 0 ? [{ id: levainId, code: 'RECETTE-LEVAIN', displayName: 'Cuve Levain recette', type: 'CUVE_INOX', capacityValue: 30, zone: 'Cuverie', status: 'PLEIN', currentLots: [{ id: 300002, businessCode: 'RECETTE-LEVAIN', currentVolume: levainVolume, status: 'ACTIF' }] }] : []),
  ] }));
  await page.route('**/api/lots?*', route => route.fulfill({ json: [
    { id: 300001, businessCode: 'RECETTE-BASE', year: 2026, mainGrapeCode: 'CH', currentVolume: sourceVolume, currentContainerId: sourceId, status: 'VIN_DE_BASE', components: [], analyses: [] },
    ...(levainVolume > 0 ? [{ id: 300002, businessCode: 'RECETTE-LEVAIN', year: 2026, mainGrapeCode: 'CH', currentVolume: levainVolume, currentContainerId: levainId, status: 'ACTIF', qualiteLot: 'LEVAIN', components: [], analyses: [] }] : []),
  ] }));
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'Compte E2E requis.');
  await page.goto('/app');
  await page.getByRole('button', { name: 'Tout refuser', exact: true }).click();
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email!);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: /tableau de bord/i })).toBeVisible();
  await page.getByRole('button', { name: /planif\. tirage/i }).click();
  return {
    sourceId, levainId,
    create: (volume: number) => { sourceVolume -= volume; levainVolume = volume; },
    feed: () => { sourceVolume = 8.189; levainVolume = 4; },
  };
}

async function prepareFeed(page: Page) {
  await page.getByRole('button', { name: /alimentation jour/i }).click();
  await page.getByLabel('Volume restant du levain (hL)', { exact: true }).fill('2');
  await page.getByLabel('Volume visé du levain (hL)', { exact: true }).fill('4');
  await page.getByLabel('Densité veille', { exact: true }).fill('1000');
  await page.getByLabel('Densité matin', { exact: true }).fill('1000');
  await page.getByLabel('Liqueur (g/L)', { exact: true }).fill('600');
  await page.getByLabel('TAV vin nourricier (%)', { exact: true }).fill('13');
  await page.getByLabel('Vin nourricier', { exact: true }).selectOption('200001');
  await page.getByLabel('Cuve à levain', { exact: true }).selectOption('200002');
}

test('la création utilise l’opération serveur et retrouve le levain après rechargement', async ({ page }) => {
  const api = await setup(page, false);
  let calls = 0;
  await page.route('**/api/levains', async route => {
    const body = route.request().postDataJSON();
    expect(body.sourceContainerId).toBe(api.sourceId);
    expect(body.volumeHl).toBeGreaterThan(0);
    expect(body.idempotencyKey).toMatch(/^[\da-f-]{36}$/);
    api.create(body.volumeHl);
    calls++;
    await route.fulfill({ status: 201, json: { status: 'SUCCESS', data: { levainContainerId: api.levainId, levainVolumeHl: body.volumeHl } } });
  });
  await page.getByRole('button', { name: /planning & stocks/i }).click();
  await page.getByLabel('Vin source du levain', { exact: true }).selectOption(String(api.sourceId));
  await page.getByRole('button', { name: /créer le levain/i }).click();
  await expect.poll(() => calls).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: /planif\. tirage/i }).click();
  await page.getByRole('button', { name: /alimentation jour/i }).click();
  await expect(page.getByLabel('Cuve à levain', { exact: true }).locator('option', { hasText: 'Cuve Levain recette' })).toHaveCount(1);
});

test('le nourrissage envoie les paramètres au serveur et relit le volume enregistré', async ({ page }) => {
  const api = await setup(page, true);
  let calls = 0;
  await page.route('**/api/levains/feed', async route => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ sourceContainerId: api.sourceId, levainContainerId: api.levainId, remainingVolumeHl: 2, finalVolumeHl: 4, previousDensity: 1000, currentDensity: 1000, liqueurSugarGPerL: 600, wineAlcoholPct: 13 });
    expect(body).not.toHaveProperty('wineVolumeHl');
    api.feed(); calls++;
    await route.fulfill({ json: { status: 'SUCCESS', data: { levainVolumeHl: 4 } } });
  });
  await prepareFeed(page);
  await page.getByRole('button', { name: /valider l.alimentation/i }).click();
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByLabel('Volume restant du levain (hL)', { exact: true })).toHaveValue('4');
  await page.reload();
  await page.getByRole('button', { name: /planif\. tirage/i }).click();
  await page.getByRole('button', { name: /alimentation jour/i }).click();
  await expect(page.getByLabel('Cuve à levain', { exact: true }).locator('option', { hasText: 'Cuve Levain recette (4.0 hL)' })).toHaveCount(1);
});

test('un refus du serveur ne simule pas un nourrissage réussi', async ({ page }) => {
  await setup(page, true);
  await page.route('**/api/levains/feed', route => route.fulfill({ status: 409, json: { message: 'Volume changé : actualisez la cuverie.' } }));
  await prepareFeed(page);
  await page.getByRole('button', { name: /valider l.alimentation/i }).click();
  await expect(page.getByText('Volume changé : actualisez la cuverie.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Volume restant du levain (hL)', { exact: true })).toHaveValue('2');
});
