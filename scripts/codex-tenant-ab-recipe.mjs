import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const root = process.cwd();
const reportPath = path.join(root, 'docs', 'codex-tenant-ab-recipe-results.json');
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const prefixes = { A: 'TEST-A-RUN-CODEX', B: 'TEST-B-RUN-CODEX' };
const demoPrefixes = { A: 'DEMO-DOMAINE-A', B: 'DEMO-DOMAINE-B' };
const orgSlugs = { A: 'test-org-a-codex', B: 'test-org-b-codex' };

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
};

const env = {
  ...parseEnvFile(path.join(root, '.env')),
  ...parseEnvFile(path.join(root, '.env.local')),
  ...process.env,
};

const accounts = {
  A: {
    ADMIN: { email: 'admin-a@cave.test', password: env.E2E_ADMIN_A_PASSWORD },
    CHEF_CAVE: { email: 'chef-a@cave.test', password: env.E2E_CHEF_A_PASSWORD },
    CAVISTE: { email: 'caviste-a@cave.test', password: env.E2E_CAVISTE_A_PASSWORD },
    LECTURE_SEULE: { email: 'lecture-a@cave.test', password: env.E2E_READONLY_A_PASSWORD ?? env.E2E_LECTURE_A_PASSWORD },
  },
  B: {
    ADMIN: { email: 'admin-b@cave.test', password: env.E2E_ADMIN_B_PASSWORD },
    CHEF_CAVE: { email: 'chef-b@cave.test', password: env.E2E_CHEF_B_PASSWORD },
    CAVISTE: { email: 'caviste-b@cave.test', password: env.E2E_CAVISTE_B_PASSWORD },
    LECTURE_SEULE: { email: 'lecture-b@cave.test', password: env.E2E_READONLY_B_PASSWORD ?? env.E2E_LECTURE_B_PASSWORD },
  },
};

const report = {
  runId,
  baseUrl,
  phases: {},
  accounts: [],
  reads: [],
  mutations: [],
  refusals: [],
  ui: [],
  risks: [],
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
};

const makeApi = (token) => async (method, route, { body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-request-id': `codex-ab-${runId}-${randomUUID()}`,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, ok: response.ok, body: await safeJson(response), route, method };
};

const expectOk = (response, label) => {
  assert(response.status >= 200 && response.status < 300, `${label}: attendu 2xx, reçu ${response.status}`);
};

const expectRefusal = (response, label) => {
  assert(![200, 201].includes(response.status), `${label}: mutation/lecture inter-organisation acceptée (${response.status})`);
  assert(response.status !== 500, `${label}: erreur 500 au lieu d'un refus`);
};

const textOf = (payload) => JSON.stringify(payload ?? {});

const findByPrefix = (items, prefix) =>
  items.find((item) => textOf(item).includes(prefix));

const getProductId = (createdProductResponse) =>
  createdProductResponse.body?.data?.product?.id ?? createdProductResponse.body?.data?.id ?? createdProductResponse.body?.id;

const signInAll = async () => {
  assert(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Variables Supabase incomplètes.');
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sessions = { A: {}, B: {} };
  for (const orgKey of ['A', 'B']) {
    for (const [roleKey, account] of Object.entries(accounts[orgKey])) {
      assert(account.password, `Mot de passe E2E manquant pour ${account.email}.`);
      const auth = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
      assert(!auth.error && auth.data.session?.access_token, `Connexion impossible pour ${account.email}.`);
      sessions[orgKey][roleKey] = {
        email: account.email,
        token: auth.data.session.access_token,
        api: makeApi(auth.data.session.access_token),
      };
    }
  }
  return sessions;
};

const dbInitialChecks = async () => {
  const orgs = {
    A: await prisma.organization.findUnique({ where: { slug: orgSlugs.A } }),
    B: await prisma.organization.findUnique({ where: { slug: orgSlugs.B } }),
  };
  assert(orgs.A?.name === 'TEST-ORG-A-CODEX', 'Organisation A absente ou nom incorrect.');
  assert(orgs.B?.name === 'TEST-ORG-B-CODEX', 'Organisation B absente ou nom incorrect.');

  const emails = Object.values(accounts).flatMap((byRole) => Object.values(byRole).map((account) => account.email));
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { memberships: true },
    orderBy: { email: 'asc' },
  });
  assert(users.length === 8, `public.users: attendu 8 comptes E2E, trouvé ${users.length}.`);
  for (const user of users) {
    assert(user.memberships.length === 1, `${user.email}: attendu exactement 1 membership, trouvé ${user.memberships.length}.`);
  }
  const duplicateMemberships = await prisma.$queryRaw`
    select user_id, count(*)::int
    from organization_members
    group by user_id
    having count(*) > 1
  `;
  assert(duplicateMemberships.length === 0, 'Des utilisateurs multi-membership existent.');

  report.phases.initialDb = {
    organizations: { A: orgs.A.id, B: orgs.B.id },
    users: users.map((user) => ({
      email: user.email,
      roleKey: user.roleKey,
      organizationId: user.memberships[0].organizationId,
    })),
    duplicateMemberships,
  };
  return orgs;
};

const validateMeAndHeaders = async (sessions, orgs) => {
  for (const orgKey of ['A', 'B']) {
    for (const [roleKey, session] of Object.entries(sessions[orgKey])) {
      const me = await session.api('GET', '/api/me');
      expectOk(me, `/api/me ${session.email}`);
      assert(me.body.organization.name === `TEST-ORG-${orgKey}-CODEX`, `${session.email}: mauvaise organisation.`);
      assert(me.body.organization.id === orgs[orgKey].id, `${session.email}: mauvais organizationId.`);
      assert(me.body.roleKey === roleKey, `${session.email}: mauvais rôle.`);
      report.accounts.push({ email: session.email, roleKey, organization: me.body.organization.name, status: me.status });

      const forced = await session.api('GET', '/api/me', {
        headers: { 'x-organization-id': String(orgs[orgKey === 'A' ? 'B' : 'A'].id) },
      });
      assert(forced.status === 403, `${session.email}: x-organization-id forcé non refusé (${forced.status}).`);
      report.refusals.push({ actor: session.email, case: 'forced x-organization-id on /api/me', status: forced.status });
    }
  }
};

const validateReadSeparation = async (adminApi, orgKey) => {
  const other = orgKey === 'A' ? 'B' : 'A';
  const routes = [
    ['/api/lots', demoPrefixes[orgKey], demoPrefixes[other]],
    ['/api/containers', demoPrefixes[orgKey], demoPrefixes[other]],
    ['/api/inventory/products', demoPrefixes[orgKey], demoPrefixes[other]],
    ['/api/workorders', demoPrefixes[orgKey], demoPrefixes[other]],
    ['/api/analyses', demoPrefixes[orgKey], demoPrefixes[other]],
    ['/api/degustations', demoPrefixes[orgKey], demoPrefixes[other]],
    ['/api/events?limit=200', demoPrefixes[orgKey], demoPrefixes[other]],
  ];
  for (const [route, expected, forbidden] of routes) {
    const response = await adminApi('GET', route);
    expectOk(response, `lecture ${orgKey} ${route}`);
    const payload = route.startsWith('/api/events') ? response.body?.data : response.body?.data ?? response.body;
    const body = textOf(payload);
    assert(body.includes(expected), `${route} ${orgKey}: préfixe ${expected} absent.`);
    assert(!body.includes(forbidden), `${route} ${orgKey}: préfixe interdit ${forbidden} visible.`);
    report.reads.push({ organization: orgKey, route, status: response.status, expected, forbiddenAbsent: true });
  }
};

const createBusinessData = async (sessions, orgs, orgKey) => {
  const admin = sessions[orgKey].ADMIN;
  const chef = sessions[orgKey].CHEF_CAVE;
  const caviste = sessions[orgKey].CAVISTE;
  const lecture = sessions[orgKey].LECTURE_SEULE;
  const prefix = prefixes[orgKey];

  const sourceContainer = await admin.api('POST', '/api/containers', {
    body: { code: `${prefix}-${runId}-CUVE-SOURCE`, displayName: `${prefix}-${runId}-CUVE-SOURCE`, type: 'CUVE_INOX', capacityValue: 10, zone: 'Codex', status: 'VIDE' },
  });
  expectOk(sourceContainer, `création cuve source ${orgKey}`);
  const destContainer = await admin.api('POST', '/api/containers', {
    body: { code: `${prefix}-${runId}-CUVE-DEST`, displayName: `${prefix}-${runId}-CUVE-DEST`, type: 'CUVE_INOX', capacityValue: 10, zone: 'Codex', status: 'VIDE' },
  });
  expectOk(destContainer, `création cuve destination ${orgKey}`);
  const product = await admin.api('POST', '/api/inventory/products', {
    body: { name: `${prefix}-${runId}-PRODUIT`, category: 'Intrants', subCategory: 'Test Codex', unit: 'kg', minStock: 0, currentStock: 5, idempotencyKey: `${prefix}-${runId}-product` },
  });
  expectOk(product, `création produit ${orgKey}`);
  const lot = await admin.api('POST', '/api/lots', {
    body: {
      code: `${prefix}-${runId}-LOT`,
      millesime: 2026,
      cepage: 'CH',
      lieu: 'CODEX',
      volume: 2,
      containerId: sourceContainer.body.id,
      status: 'VIN_DE_BASE',
      notes: `${prefix}-${runId}-LOT`,
      idempotencyKey: `${prefix}-${runId}-lot`,
    },
  });
  expectOk(lot, `création lot ${orgKey}`);

  const workOrder = await chef.api('POST', '/api/workorders', {
    body: {
      recette: 'SOUTIRAGE',
      targetContainerId: destContainer.body.id,
      sources: [{ lotId: lot.body.data.lot.id, volume: 1, role: 'MAIN' }],
      details: `${prefix}-${runId}-WO`,
      idempotencyKey: `${prefix}-${runId}-wo`,
    },
  });
  expectOk(workOrder, `création ordre ${orgKey}`);
  const workOrderId = workOrder.body.data.id;

  const transfer = await caviste.api('POST', '/api/transfers', {
    body: {
      lotId: lot.body.data.lot.id,
      fromId: sourceContainer.body.id,
      destinations: [{ toId: destContainer.body.id, volume: 1 }],
      volume: 1,
      date: new Date().toISOString(),
      note: `${prefix}-${runId}-EXEC`,
      idempotencyKey: randomUUID(),
    },
  });
  expectOk(transfer, `exécution transfert ordre ${orgKey}`);

  const completed = await caviste.api('PATCH', `/api/workorders/${workOrderId}`, {
    body: { status: 'DONE', evidence: { businessOperation: 'TRANSFERT', runId, transfer: transfer.body } },
  });
  expectOk(completed, `clôture ordre ${orgKey}`);

  const readOnlyMutation = await lecture.api('POST', '/api/containers', {
    body: { code: `${prefix}-${runId}-LECTURE-FORBIDDEN`, displayName: `${prefix}-${runId}-LECTURE-FORBIDDEN`, capacityValue: 1 },
  });
  expectRefusal(readOnlyMutation, `mutation lecture seule ${orgKey}`);
  assert(readOnlyMutation.status === 403, `lecture seule ${orgKey}: attendu 403, reçu ${readOnlyMutation.status}`);
  report.refusals.push({ actor: lecture.email, organization: orgKey, case: 'read-only container creation', status: readOnlyMutation.status });

  const db = {
    sourceContainer: await prisma.container.findUnique({ where: { id: sourceContainer.body.id } }),
    destContainer: await prisma.container.findUnique({ where: { id: destContainer.body.id } }),
    product: await prisma.product.findUnique({ where: { id: getProductId(product) } }),
    lot: await prisma.lot.findUnique({ where: { id: lot.body.data.lot.id } }),
    workOrder: await prisma.workOrder.findFirst({ where: { publicId: workOrderId } }),
    lotEvents: await prisma.lotEvent.findMany({ where: { organizationId: orgs[orgKey].id, comment: { contains: prefix } } }),
  };
  for (const [name, value] of Object.entries(db)) {
    if (Array.isArray(value)) continue;
    assert(value?.organizationId === orgs[orgKey].id, `${orgKey}: ${name} sans organizationId correct.`);
  }
  assert(db.workOrder.status === 'DONE', `${orgKey}: workOrder non DONE.`);
  assert(db.workOrder.executionEvidence, `${orgKey}: executionEvidence manquant.`);
  assert(db.lotEvents.length > 0, `${orgKey}: aucun LotEvent lié à l'exécution/transfert.`);

  const ownWorkOrders = await admin.api('GET', '/api/workorders');
  expectOk(ownWorkOrders, `lecture workorders après mutation ${orgKey}`);
  assert(textOf(ownWorkOrders.body).includes(workOrderId), `${orgKey}: ordre créé invisible côté propre org.`);

  report.mutations.push({
    organization: orgKey,
    prefix,
    sourceContainerId: sourceContainer.body.id,
    destContainerId: destContainer.body.id,
    productId: getProductId(product),
    lotId: lot.body.data.lot.id,
    workOrderId,
    transferStatus: transfer.status,
    completedStatus: completed.status,
  });

  return {
    sourceContainerId: sourceContainer.body.id,
    destContainerId: destContainer.body.id,
    productId: getProductId(product),
    lotId: lot.body.data.lot.id,
    lotCode: lot.body.data.lot.businessCode,
    workOrderId,
  };
};

const snapshot = async (data) => ({
  lots: await prisma.lot.findMany({ where: { id: { in: [data.A.lotId, data.B.lotId] } }, select: { id: true, organizationId: true, currentVolume: true } }),
  containers: await prisma.container.findMany({ where: { id: { in: [data.A.destContainerId, data.B.destContainerId] } }, select: { id: true, organizationId: true, status: true } }),
  products: await prisma.product.findMany({ where: { id: { in: [data.A.productId, data.B.productId] } }, select: { id: true, organizationId: true, currentStock: true } }),
  workOrders: await prisma.workOrder.findMany({ where: { publicId: { in: [data.A.workOrderId, data.B.workOrderId] } }, select: { publicId: true, organizationId: true, status: true } }),
  auditLogs: await prisma.auditLog.count(),
});

const normalize = (value) => JSON.stringify(value, (_, item) => typeof item?.toString === 'function' && item.constructor?.name === 'Decimal' ? item.toString() : item);

const antiTelescoping = async (sessions, data) => {
  const attempts = [
    ['A', 'B', 'POST', '/api/lots/volume', (target) => ({ lotId: target.lotId, newVolume: 1.5, note: 'cross org', idempotencyKey: `${prefixes.A}-${runId}-cross-volume` }), 'modifier un lot B'],
    ['A', 'B', 'PUT', '/api/containers', (target) => ({ id: target.destContainerId, status: 'NETTOYAGE' }), 'modifier une cuve B'],
    ['A', 'B', 'POST', '/api/inventory/movements', (target) => ({ productId: target.productId, type: 'OUT', quantity: 1, note: 'cross org', idempotencyKey: randomUUID() }), 'utiliser un produit B'],
    ['A', 'B', 'PATCH', (target) => `/api/workorders/${target.workOrderId}`, () => ({ status: 'DONE', evidence: { cross: true } }), 'exécuter un workOrder B'],
    ['A', 'B', 'POST', '/api/tracabilite', (target) => ({ type: 'bulk', lotCode: target.lotCode }), 'consulter la traçabilité d’un lot B'],
    ['B', 'A', 'POST', '/api/lots/volume', (target) => ({ lotId: target.lotId, newVolume: 1.5, note: 'cross org', idempotencyKey: `${prefixes.B}-${runId}-cross-volume` }), 'modifier un lot A'],
    ['B', 'A', 'PUT', '/api/containers', (target) => ({ id: target.destContainerId, status: 'NETTOYAGE' }), 'modifier une cuve A'],
    ['B', 'A', 'POST', '/api/inventory/movements', (target) => ({ productId: target.productId, type: 'OUT', quantity: 1, note: 'cross org', idempotencyKey: randomUUID() }), 'utiliser un produit A'],
    ['B', 'A', 'PATCH', (target) => `/api/workorders/${target.workOrderId}`, () => ({ status: 'DONE', evidence: { cross: true } }), 'exécuter un workOrder A'],
    ['B', 'A', 'POST', '/api/tracabilite', (target) => ({ type: 'bulk', lotCode: target.lotCode }), 'consulter la traçabilité d’un lot A'],
  ];

  for (const [actorOrg, targetOrg, method, routeOrFn, bodyFn, label] of attempts) {
    const before = await snapshot(data);
    const target = data[targetOrg];
    const route = typeof routeOrFn === 'function' ? routeOrFn(target) : routeOrFn;
    const response = await sessions[actorOrg].ADMIN.api(method, route, { body: bodyFn(target) });
    expectRefusal(response, `${actorOrg} tente ${label}`);
    const after = await snapshot(data);
    assert(normalize(before) === normalize(after), `${actorOrg} tente ${label}: snapshot modifié malgré refus.`);
    report.refusals.push({ actorOrganization: actorOrg, targetOrganization: targetOrg, case: label, route, status: response.status });
  }
};

const finalDbChecks = async (orgs) => {
  const scopedChecks = {};
  for (const orgKey of ['A', 'B']) {
    const prefix = prefixes[orgKey];
    const orgId = orgs[orgKey].id;
    scopedChecks[orgKey] = {
      containersWrongOrg: await prisma.container.count({ where: { code: { contains: prefix }, organizationId: { not: orgId } } }),
      lotsWrongOrg: await prisma.lot.count({ where: { businessCode: { contains: prefix }, organizationId: { not: orgId } } }),
      productsWrongOrg: await prisma.product.count({ where: { name: { contains: prefix }, organizationId: { not: orgId } } }),
      workOrdersWrongOrg: await prisma.workOrder.count({ where: { details: { contains: prefix }, organizationId: { not: orgId } } }),
    };
    assert(Object.values(scopedChecks[orgKey]).every((count) => count === 0), `${orgKey}: objets avec mauvais organizationId.`);
  }
  const duplicateMemberships = await prisma.$queryRaw`
    select user_id, count(*)::int
    from organization_members
    group by user_id
    having count(*) > 1
  `;
  assert(duplicateMemberships.length === 0, 'Doublons de memberships détectés en fin de recette.');
  report.phases.finalDb = { scopedChecks, duplicateMemberships };
};

const validateUi = async () => {
  const issues = [];
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {});

  try {
    for (const orgKey of ['A', 'B']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error' && /uncaught|typeerror|referenceerror|hydration|next\.js.+error/i.test(message.text())) {
          issues.push(message.text());
        }
      });
      page.on('pageerror', (error) => issues.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 500) issues.push(`HTTP ${response.status()} ${response.url()}`);
      });

      await page.goto(baseUrl);
      await page.getByPlaceholder('vous@domaine.fr').fill(accounts[orgKey].ADMIN.email);
      await page.locator('input[type="password"]').fill(accounts[orgKey].ADMIN.password);
      await page.getByRole('button', { name: /se connecter/i }).click();
      await page.getByRole('heading', { name: /tableau de bord/i }).waitFor({ timeout: 30000 });
      const dashboardBody = await page.locator('body').innerText();
      assert(dashboardBody.includes(`Espace : TEST-ORG-${orgKey}-CODEX`), `UI ${orgKey}: espace organisation absent.`);
      assert(!dashboardBody.includes(demoPrefixes[orgKey === 'A' ? 'B' : 'A']), `UI ${orgKey}: donnée démo croisée visible sur dashboard.`);
      assert(!/sélecteur d'organisation|choisir l'organisation/i.test(dashboardBody), `UI ${orgKey}: sélecteur d'organisation visible.`);
      assert(!/Invalid Date|Unhandled Runtime Error|hydration failed/i.test(dashboardBody), `UI ${orgKey}: erreur runtime visible.`);
      assert(await page.locator('nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-toast]').count() === 0, `UI ${orgKey}: overlay Next visible.`);

      await page.getByRole('button', { name: /cuverie/i }).first().click();
      await page.getByRole('heading', { name: /cuverie/i }).waitFor({ timeout: 15000 });
      await page.waitForFunction(
        ([demoPrefix, runPrefix]) => document.body.innerText.includes(demoPrefix) || document.body.innerText.includes(runPrefix),
        [demoPrefixes[orgKey], prefixes[orgKey]],
        { timeout: 15000 },
      ).catch(() => undefined);
      const cuverieBody = await page.locator('body').innerText();
      await page.getByRole('button', { name: /lots/i }).first().click();
      await page.getByRole('heading', { name: /^lots$/i }).waitFor({ timeout: 15000 });
      await page.waitForFunction(
        ([demoPrefix, runPrefix]) => document.body.innerText.includes(demoPrefix) || document.body.innerText.includes(runPrefix),
        [demoPrefixes[orgKey], prefixes[orgKey]],
        { timeout: 15000 },
      ).catch(() => undefined);
      const lotsBody = await page.locator('body').innerText();
      const businessText = `${cuverieBody}\n${lotsBody}`;
      assert(businessText.includes(demoPrefixes[orgKey]) || businessText.includes(prefixes[orgKey]), `UI ${orgKey}: aucune donnée propre visible dans Cuverie/Lots.`);
      assert(!businessText.includes(demoPrefixes[orgKey === 'A' ? 'B' : 'A']), `UI ${orgKey}: donnée croisée visible dans Cuverie/Lots.`);

      report.ui.push({ organization: orgKey, dashboard: true, cuverieLots: true });
      await context.close();
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  assert(issues.length === 0, `Erreurs console critiques UI: ${issues.join(' | ')}`);
};

async function main() {
  const orgs = await dbInitialChecks();
  const sessions = await signInAll();
  await validateMeAndHeaders(sessions, orgs);
  await validateReadSeparation(sessions.A.ADMIN.api, 'A');
  await validateReadSeparation(sessions.B.ADMIN.api, 'B');

  const data = {
    A: await createBusinessData(sessions, orgs, 'A'),
    B: await createBusinessData(sessions, orgs, 'B'),
  };

  const aReads = await sessions.A.ADMIN.api('GET', '/api/workorders');
  const bReads = await sessions.B.ADMIN.api('GET', '/api/workorders');
  assert(textOf(aReads.body).includes(data.A.workOrderId) && !textOf(aReads.body).includes(data.B.workOrderId), 'Tâches A/B mélangées côté A.');
  assert(textOf(bReads.body).includes(data.B.workOrderId) && !textOf(bReads.body).includes(data.A.workOrderId), 'Tâches A/B mélangées côté B.');

  const aEvents = await sessions.A.ADMIN.api('GET', '/api/events?limit=200');
  const bEvents = await sessions.B.ADMIN.api('GET', '/api/events?limit=200');
  assert(textOf(aEvents.body).includes(prefixes.A) && !textOf(aEvents.body).includes(prefixes.B), 'Activité récente events mélangée côté A.');
  assert(textOf(bEvents.body).includes(prefixes.B) && !textOf(bEvents.body).includes(prefixes.A), 'Activité récente events mélangée côté B.');
  report.phases.activityAndTasks = { A: true, B: true };

  await antiTelescoping(sessions, data);
  await validateUi();
  await finalDbChecks(orgs);

  fs.writeFileSync(reportPath, `${JSON.stringify({ ok: true, ...report }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, reportPath, mutations: report.mutations.length, refusals: report.refusals.length }, null, 2));
}

main()
  .catch((error) => {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ ok: false, error: error.message, ...report }, null, 2)}\n`);
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
