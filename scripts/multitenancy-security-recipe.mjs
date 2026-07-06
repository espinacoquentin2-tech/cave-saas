import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'docs', 'multitenancy-recipe-results.json');
const PREFIX_A = 'TEST-ORG-A-CODEX';
const PREFIX_B = 'TEST-ORG-B-CODEX';
const RUN = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

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
  ...parseEnvFile(path.join(ROOT, '.env')),
  ...parseEnvFile(path.join(ROOT, '.env.local')),
  ...process.env,
};

const baseUrl = env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = env.E2E_ADMIN_EMAIL;
const adminPassword = env.E2E_ADMIN_PASSWORD;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const report = {
  run: RUN,
  prefixes: { A: PREFIX_A, B: PREFIX_B },
  baseUrl,
  migration: {},
  organizations: {},
  memberships: [],
  data: { A: {}, B: {} },
  mutations: [],
  reads: [],
  refusals: [],
  validOperations: [],
  frontendHeaders: [],
  fixesNeeded: [],
};

const record = (section, entry) => {
  report[section].push({ at: new Date().toISOString(), ...entry });
};

const decimal = (value) => new Prisma.Decimal(Number(value).toFixed(3));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
};

const makeApi = (token) => async (method, route, { orgId, body, noOrganizationHeader = false } = {}) => {
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-request-id': `codex-${RUN}-${randomUUID()}`,
  };
  if (!noOrganizationHeader && orgId) {
    headers['x-organization-id'] = String(orgId);
  }
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    method,
    route,
    status: response.status,
    ok: response.ok,
    body: await safeJson(response),
  };
};

const expectNotOkNo500 = (response, label) => {
  assert(response.status !== 200 && response.status !== 201, `${label}: accès inter-organisation accepté (${response.status})`);
  assert(response.status !== 500, `${label}: erreur 500 au lieu d'un refus métier`);
};

const expectOk = (response, label) => {
  assert(response.status >= 200 && response.status < 300, `${label}: attendu 2xx, reçu ${response.status}`);
};

const ensureUser = async (email, roleKey, name) => prisma.user.upsert({
  where: { email },
  create: { email, roleKey, role: roleKey, name },
  update: { roleKey, role: roleKey },
});

const ensureMembership = async (organizationId, userId, roleKey) => {
  const membership = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, roleKey },
    update: { roleKey },
  });
  report.memberships.push({ organizationId, userId, roleKey, membershipId: membership.id });
  return membership;
};

const createContainer = async (org, suffix, status = 'VIDE') => {
  const code = `${org.prefix}-${RUN}-${suffix}`;
  const container = await prisma.container.create({
    data: {
      organizationId: org.id,
      code,
      displayName: code,
      type: 'CUVE_INOX',
      capacityValue: decimal(500),
      capacityUnit: 'hL',
      zone: 'Codex',
      status,
      notes: `Recette multi-tenant ${RUN}`,
    },
  });
  record('mutations', { type: 'db.create.container', organizationId: org.id, id: container.id, code });
  return container;
};

const createLot = async (org, suffix, container, volume, status, grape = 'CH') => {
  const code = `${org.prefix}-${RUN}-${suffix}`;
  const lot = await prisma.lot.create({
    data: {
      organizationId: org.id,
      technicalCode: `${code}-TECH`,
      businessCode: code,
      year: 2026,
      mainGrapeCode: grape,
      placeCode: 'CODEX',
      sequenceNumber: Number(`${org.id}${Math.floor(Math.random() * 10000)}`),
      status,
      currentVolume: decimal(volume),
      currentContainerId: container.id,
      notes: `Recette multi-tenant ${RUN}`,
    },
  });
  await prisma.container.updateMany({ where: { id: container.id, organizationId: org.id }, data: { status: 'PLEIN' } });
  record('mutations', { type: 'db.create.lot', organizationId: org.id, id: lot.id, code, containerId: container.id });
  return lot;
};

const createProduct = async (org, suffix, category, subCategory, unit, stock) => {
  const product = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: `${org.prefix}-${RUN}-${suffix}`,
      category,
      subCategory,
      unit,
      minStock: decimal(0),
      currentStock: decimal(stock),
    },
  });
  record('mutations', { type: 'db.create.product', organizationId: org.id, id: product.id, name: product.name });
  return product;
};

const createBottleLot = async (org, suffix, sourceLot) => {
  const code = `${org.prefix}-${RUN}-${suffix}`;
  const bottleLot = await prisma.bottleLot.create({
    data: {
      organizationId: org.id,
      technicalCode: `${code}-TECH`,
      businessCode: code,
      type: 'HABILLE',
      sourceLotId: sourceLot.id,
      formatCode: '75cl',
      initialBottleCount: 24,
      currentBottleCount: 24,
      status: 'PRET_EXPEDITION',
      tirageDate: new Date('2026-01-15T00:00:00.000Z'),
      locationZone: 'Codex',
    },
  });
  record('mutations', { type: 'db.create.bottleLot', organizationId: org.id, id: bottleLot.id, code });
  return bottleLot;
};

const createAnalysis = async (org, lot) => {
  const analysis = await prisma.analysis.create({
    data: {
      organizationId: org.id,
      lotId: lot.id,
      analysisDate: new Date(),
      ph: 3.12,
      at: 4.8,
      alcohol: 10.5,
      notes: `${org.prefix}-${RUN}-ANALYSE`,
    },
  });
  record('mutations', { type: 'db.create.analysis', organizationId: org.id, id: analysis.id, lotId: lot.id });
  return analysis;
};

const createDegustation = async (org, lot) => {
  const degustation = await prisma.degustation.create({
    data: {
      organizationId: org.id,
      date: new Date(),
      phase: 'VINS_CLAIRS',
      lotId: String(lot.id),
      robe: 'clair',
      nez: org.prefix,
      bouche: 'test',
      noteGlobale: 14,
      operator: 'Codex',
      notes: `${org.prefix}-${RUN}-DEGUSTATION`,
    },
  });
  record('mutations', { type: 'db.create.degustation', organizationId: org.id, id: degustation.id, lotId: lot.id });
  return degustation;
};

const createWorkOrder = async (org, lot, container) => {
  const workOrder = await prisma.workOrder.create({
    data: {
      organizationId: org.id,
      publicId: `${org.prefix}-${RUN}-WO`,
      recette: 'SOUTIRAGE',
      targetContainerId: container.id,
      sources: [{ lotId: lot.id, volume: 1, role: 'MAIN' }],
      plannedVolume: decimal(1),
      details: `${org.prefix}-${RUN}-WORKORDER`,
      createdBy: adminEmail,
      operator: adminEmail,
    },
  });
  record('mutations', { type: 'db.create.workOrder', organizationId: org.id, id: workOrder.id, publicId: workOrder.publicId });
  return workOrder;
};

const createTraceEvent = async (org, user, lot) => {
  const event = await prisma.lotEvent.create({
    data: {
      organizationId: org.id,
      eventType: 'CODEX_TRACE_TEST',
      operatorUserId: user.id,
      comment: `${org.prefix}-${RUN}-EVENT`,
      metadata: { run: RUN, prefix: org.prefix },
    },
  });
  await prisma.lotEventLot.create({
    data: { eventId: event.id, lotId: lot.id, roleInEvent: 'CIBLE', volumeChange: decimal(0), unit: 'hL' },
  });
  record('mutations', { type: 'db.create.lotEvent', organizationId: org.id, id: event.id, lotId: lot.id });
  return event;
};

const snapshot = async (ids) => ({
  lots: await prisma.lot.findMany({ where: { id: { in: ids.lotIds ?? [] } }, select: { id: true, currentVolume: true, status: true } }),
  containers: await prisma.container.findMany({ where: { id: { in: ids.containerIds ?? [] } }, select: { id: true, status: true, displayName: true } }),
  products: await prisma.product.findMany({ where: { id: { in: ids.productIds ?? [] } }, select: { id: true, currentStock: true } }),
  workOrders: await prisma.workOrder.findMany({ where: { id: { in: ids.workOrderIds ?? [] } }, select: { id: true, status: true } }),
  lotEvents: await prisma.lotEvent.count({ where: { organizationId: { in: ids.organizationIds ?? [] }, createdAt: { gte: ids.since } } }),
  bottleEvents: await prisma.bottleEvent.count({ where: { organizationId: { in: ids.organizationIds ?? [] }, createdAt: { gte: ids.since } } }),
  stockMovements: await prisma.stockMovement.count({ where: { organizationId: { in: ids.organizationIds ?? [] }, createdAt: { gte: ids.since } } }),
  bottleLots: await prisma.bottleLot.count({ where: { organizationId: { in: ids.organizationIds ?? [] }, createdAt: { gte: ids.since } } }),
});

const normalizeSnapshot = (value) => JSON.stringify(value, (_, item) => {
  if (item instanceof Prisma.Decimal) return item.toString();
  return item;
});

const verifyUnchanged = (before, after, label) => {
  assert(normalizeSnapshot(before) === normalizeSnapshot(after), `${label}: snapshot modifié malgré refus`);
};

async function main() {
  assert(adminEmail && adminPassword && supabaseUrl && supabaseAnonKey, 'Variables E2E/Supabase incomplètes.');

  const [organizationsTable, membersTable] = await Promise.all([
    prisma.$queryRaw`SELECT to_regclass('public.organizations')::text AS name`,
    prisma.$queryRaw`SELECT to_regclass('public.organization_members')::text AS name`,
  ]);
  const demo = await prisma.organization.findUnique({ where: { slug: 'organisation-demo' } });
  const existingMemberships = await prisma.organizationMember.count();
  const scopedTables = [
    'containers', 'lots', 'analyses', 'lot_events', 'bottle_lots', 'bottle_events', 'shipments',
    'fa_readings', 'pressings', 'Maturation', 'Parcelle', 'Degustation', 'Pressoir', 'products',
    'stock_movements', 'audit_logs', 'work_orders',
  ];
  const columnChecks = [];
  for (const table of scopedTables) {
    const [{ organization_id: columnExists }] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id'
      ) AS organization_id`,
      table,
    );
    const [{ count: nullCount }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "organization_id" IS NULL`,
    );
    columnChecks.push({ table, columnExists, nullCount });
  }
  const [sequence] = await prisma.$queryRaw`
    SELECT
      (SELECT MAX(id)::int FROM organizations) AS max_id,
      (SELECT last_value::int FROM organizations_id_seq) AS last_value
  `;
  report.migration = {
    organizationsTable: Boolean(organizationsTable[0]?.name),
    organizationMembersTable: Boolean(membersTable[0]?.name),
    demoOrganizationId: demo?.id ?? null,
    existingMemberships,
    scopedTables: columnChecks,
    sequence,
  };
  assert(report.migration.organizationsTable, 'Table organizations absente.');
  assert(report.migration.organizationMembersTable, 'Table organization_members absente.');
  assert(demo, 'Organisation Démo absente.');
  assert(existingMemberships > 0, 'Aucun membership existant.');
  assert(columnChecks.every((check) => check.columnExists && check.nullCount === 0), 'Colonnes organization_id absentes ou nulles.');
  assert(sequence.last_value >= sequence.max_id, 'Séquence organizations.id non réalignée.');

  const orgA = await prisma.organization.upsert({
    where: { slug: 'test-org-a-codex' },
    create: { name: PREFIX_A, slug: 'test-org-a-codex' },
    update: { name: PREFIX_A },
  });
  const orgB = await prisma.organization.upsert({
    where: { slug: 'test-org-b-codex' },
    create: { name: PREFIX_B, slug: 'test-org-b-codex' },
    update: { name: PREFIX_B },
  });
  report.organizations = { A: orgA, B: orgB };

  const admin = await ensureUser(adminEmail, 'ADMIN', 'Codex Admin E2E');
  const chef = await ensureUser(env.E2E_CHEF_CAVE_EMAIL || 'chef@cave.fr', 'CHEF_CAVE', 'Codex Chef E2E');
  const caviste = await ensureUser(env.E2E_CAVISTE_EMAIL || 'caviste@cave.fr', 'CAVISTE', 'Codex Caviste E2E');
  await ensureMembership(orgA.id, admin.id, 'ADMIN');
  await ensureMembership(orgA.id, chef.id, 'CHEF_CAVE');
  await ensureMembership(orgA.id, caviste.id, 'CAVISTE');
  await ensureMembership(orgB.id, admin.id, 'ADMIN');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
  assert(!auth.error && auth.data.session?.access_token, 'Connexion E2E impossible.');
  const api = makeApi(auth.data.session.access_token);

  const mkOrg = (dbOrg, prefix) => ({ id: dbOrg.id, prefix });
  const A = mkOrg(orgA, PREFIX_A);
  const B = mkOrg(orgB, PREFIX_B);

  const data = {};
  for (const org of [A, B]) {
    const transferSourceContainer = await createContainer(org, 'CUVE-TRANSFER-SOURCE');
    const transferDestContainer = await createContainer(org, 'CUVE-TRANSFER-DEST');
    const assemblageMainContainer = await createContainer(org, 'CUVE-ASSEMB-MAIN');
    const assemblageReserveContainer = await createContainer(org, 'CUVE-ASSEMB-RESERVE');
    const assemblageDestContainer = await createContainer(org, 'CUVE-ASSEMB-DEST');
    const intrantContainer = await createContainer(org, 'CUVE-INTRANT');
    const tirageContainer = await createContainer(org, 'CUVE-TIRAGE');
    const vracContainer = await createContainer(org, 'CUVE-VRAC');
    const genericContainer = await createContainer(org, 'CUVE-GENERIC');
    const transferLot = await createLot(org, 'LOT-TRANSFER', transferSourceContainer, 20, 'VIN_DE_BASE');
    const assemblageMainLot = await createLot(org, 'LOT-ASSEMB-MAIN', assemblageMainContainer, 12, 'VIN_DE_BASE');
    const assemblageReserveLot = await createLot(org, 'LOT-ASSEMB-RESERVE', assemblageReserveContainer, 12, 'RESERVE', 'PN');
    const intrantLot = await createLot(org, 'LOT-INTRANT', intrantContainer, 10, 'VIN_DE_BASE');
    const tirageLot = await createLot(org, 'LOT-TIRAGE', tirageContainer, 3, 'VIN_DE_BASE');
    const vracLot = await createLot(org, 'LOT-VRAC', vracContainer, 10, 'VIN_DE_BASE');
    const genericLot = await createLot(org, 'LOT-GENERIC', genericContainer, 5, 'VIN_DE_BASE');
    const intrantProduct = await createProduct(org, 'PRODUIT-INTRANT', 'Intrants', 'Sucres', 'kg', 100);
    const bottleProduct = await createProduct(org, 'PRODUIT-BOUTEILLES', 'Matières sèches', 'bouteilles', 'unites', 100);
    const capsuleProduct = await createProduct(org, 'PRODUIT-CAPSULES', 'Matières sèches', 'capsules', 'unites', 100);
    const biduleProduct = await createProduct(org, 'PRODUIT-BIDULES', 'Matières sèches', 'bidules', 'unites', 100);
    const bottleLot = await createBottleLot(org, 'BOTTLELOT', genericLot);
    const analysis = await createAnalysis(org, genericLot);
    const degustation = await createDegustation(org, genericLot);
    const workOrder = await createWorkOrder(org, genericLot, transferDestContainer);
    const traceEvent = await createTraceEvent(org, admin, genericLot);
    data[org.prefix] = {
      transferSourceContainer, transferDestContainer, assemblageMainContainer, assemblageReserveContainer,
      assemblageDestContainer, intrantContainer, tirageContainer, vracContainer, genericContainer,
      transferLot, assemblageMainLot, assemblageReserveLot, intrantLot, tirageLot, vracLot, genericLot,
      intrantProduct, bottleProduct, capsuleProduct, biduleProduct, bottleLot, analysis, degustation, workOrder, traceEvent,
    };
  }
  report.data.A = Object.fromEntries(Object.entries(data[PREFIX_A]).map(([key, value]) => [key, value.id ?? value.publicId]));
  report.data.B = Object.fromEntries(Object.entries(data[PREFIX_B]).map(([key, value]) => [key, value.id ?? value.publicId]));

  const AData = data[PREFIX_A];
  const BData = data[PREFIX_B];
  const bExpeditionEvent = await prisma.bottleEvent.create({
    data: {
      organizationId: orgB.id,
      eventType: 'EXPEDITION',
      operatorUserId: admin.id,
      comment: `${PREFIX_B}-${RUN}-EXPEDITION-B`,
      metadata: { sourceBottleLotId: BData.bottleLot.id, quantity: 1, deliveryStatus: 'PREPAREE' },
    },
  });
  await prisma.bottleEventLink.create({
    data: { eventId: bExpeditionEvent.id, bottleLotId: BData.bottleLot.id, roleInEvent: 'SOURCE', bottleCount: 1 },
  });
  record('mutations', { type: 'db.create.bottleEvent.expedition', organizationId: orgB.id, id: bExpeditionEvent.id });

  const noHeader = await api('GET', '/api/lots', { noOrganizationHeader: true });
  record('frontendHeaders', {
    case: 'multi-membership without x-organization-id',
    status: noHeader.status,
    message: noHeader.body?.message ?? noHeader.body?.error ?? null,
  });
  assert(noHeader.status === 403, 'Un utilisateur multi-organisations sans header doit être refusé.');

  const readCases = [
    ['/api/lots', 'businessCode', AData.genericLot.businessCode, BData.genericLot.businessCode],
    ['/api/containers', 'code', AData.genericContainer.code, BData.genericContainer.code],
    ['/api/inventory/products', 'name', AData.intrantProduct.name, BData.intrantProduct.name],
    ['/api/analyses', 'notes', `${PREFIX_A}-${RUN}-ANALYSE`, `${PREFIX_B}-${RUN}-ANALYSE`],
    ['/api/degustations', 'notes', `${PREFIX_A}-${RUN}-DEGUSTATION`, `${PREFIX_B}-${RUN}-DEGUSTATION`],
    ['/api/events', 'comment', `${PREFIX_A}-${RUN}-EVENT`, `${PREFIX_B}-${RUN}-EVENT`],
  ];
  for (const [route, field, expectedA, forbiddenB] of readCases) {
    const responseA = await api('GET', route, { orgId: orgA.id });
    expectOk(responseA, `lecture A ${route}`);
    const payloadA = route === '/api/events' ? responseA.body.data : responseA.body;
    const textA = JSON.stringify(payloadA);
    assert(textA.includes(String(expectedA)), `lecture A ${route}: donnée A absente`);
    assert(!textA.includes(String(forbiddenB)), `lecture A ${route}: donnée B visible`);
    record('reads', { route, organizationId: orgA.id, status: responseA.status, field });

    const responseB = await api('GET', route, { orgId: orgB.id });
    expectOk(responseB, `lecture B ${route}`);
    const payloadB = route === '/api/events' ? responseB.body.data : responseB.body;
    const textB = JSON.stringify(payloadB);
    assert(textB.includes(String(forbiddenB)), `lecture B ${route}: donnée B absente`);
    assert(!textB.includes(String(expectedA)), `lecture B ${route}: donnée A visible`);
    record('reads', { route, organizationId: orgB.id, status: responseB.status, field });
  }

  const workOrdersA = await api('GET', '/api/workorders', { orgId: orgA.id });
  expectOk(workOrdersA, 'lecture A workorders');
  assert(JSON.stringify(workOrdersA.body).includes(AData.workOrder.publicId), 'workOrder A absent');
  assert(!JSON.stringify(workOrdersA.body).includes(BData.workOrder.publicId), 'workOrder B visible depuis A');
  record('reads', { route: '/api/workorders', organizationId: orgA.id, status: workOrdersA.status });

  const refusalSince = new Date();
  const refusalIds = {
    organizationIds: [orgA.id, orgB.id],
    lotIds: [AData.transferLot.id, AData.assemblageMainLot.id, BData.assemblageReserveLot.id, BData.vracLot.id],
    containerIds: [BData.transferDestContainer.id],
    productIds: [BData.intrantProduct.id, BData.bottleProduct.id, BData.capsuleProduct.id, BData.biduleProduct.id],
    workOrderIds: [BData.workOrder.id],
    since: refusalSince,
  };

  const refusalTests = [
    ['POST', '/api/lots/volume', { lotId: BData.genericLot.id, newVolume: 4, note: 'cross org', idempotencyKey: `${PREFIX_A}-vol-${RUN}` }, 'modifier lot B depuis A'],
    ['PUT', '/api/containers', { id: BData.genericContainer.id, status: 'NETTOYAGE' }, 'modifier cuve B depuis A'],
    ['POST', '/api/inventory/movements', { productId: BData.intrantProduct.id, type: 'OUT', quantity: 1, note: 'cross org', idempotencyKey: randomUUID() }, 'modifier produit B depuis A'],
    ['POST', `/api/workorders/${BData.workOrder.publicId}/cancel`, { reason: 'cross org' }, 'annuler workOrder B depuis A'],
    ['POST', '/api/analyses', { analyses: [{ id: BData.analysis.id, lotId: BData.genericLot.id, analysisDate: new Date().toISOString(), ph: 3.2, notes: 'cross org' }], idempotencyKey: `${PREFIX_A}-analysis-${RUN}` }, 'modifier analyse B depuis A'],
    ['POST', '/api/degustations', { date: new Date().toISOString(), phase: 'VINS_CLAIRS', lotId: String(BData.genericLot.id), robe: 'x', nez: 'x', bouche: 'x', idempotencyKey: `${PREFIX_A}-deg-${RUN}` }, 'créer dégustation A sur lot B'],
    ['POST', '/api/transfers', { lotId: AData.transferLot.id, fromId: AData.transferSourceContainer.id, destinations: [{ toId: BData.transferDestContainer.id, volume: 1 }], volume: 1, date: new Date().toISOString(), idempotencyKey: randomUUID(), note: 'cross org' }, 'transfert lot A vers cuve B'],
    ['POST', '/api/assemblages', { code: `${PREFIX_A}-${RUN}-ASSEMB-CROSS`, assemblageType: 'BSA', millesime: 'SA', components: [{ sourceType: 'LOT', lotId: AData.assemblageMainLot.id, volumeHl: 1, sourceRole: 'MAIN' }, { sourceType: 'LOT', lotId: BData.assemblageReserveLot.id, volumeHl: 1, sourceRole: 'RESERVE' }], containerDestinationId: AData.assemblageDestContainer.id, idempotencyKey: `${PREFIX_A}-assemblage-cross-${RUN}` }, 'assemblage source A + B'],
    ['POST', '/api/lots/intrants', { lotId: AData.intrantLot.id, intrant: 'Chaptalisation (Sucre)', quantity: 1, unit: 'kg', productId: BData.intrantProduct.id, note: 'cross org', idempotencyKey: `${PREFIX_A}-intrant-cross-${RUN}` }, 'intrant produit B sur lot A'],
    ['POST', '/api/tirage', { lotId: AData.tirageLot.id, sourceContainerId: AData.tirageContainer.id, format: '75cl', count: 1, volume: 0.008, bouchage: 'CAPSULE', zone: 'Codex', tirageDate: new Date().toISOString(), isTranquille: false, stockItems: [{ productId: BData.bottleProduct.id, kind: 'PACKAGING_BOTTLE', quantity: 1, unit: 'unites', label: 'Bouteille B' }, { productId: BData.capsuleProduct.id, kind: 'PACKAGING_PRIMARY_CLOSURE', quantity: 1, unit: 'unites', label: 'Capsule B' }, { productId: BData.biduleProduct.id, kind: 'PACKAGING_SECONDARY_CLOSURE', quantity: 1, unit: 'unites', label: 'Bidule B' }], calculatedItems: [], idempotencyKey: randomUUID() }, 'tirage lot A avec produits B'],
    ['POST', '/api/bottles/status', { blId: BData.bottleLot.id, status: 'SUR_LATTES', location: 'A', note: 'cross org', idempotencyKey: `${PREFIX_A}-bstatus-${RUN}` }, 'statut BottleLot B depuis A'],
    ['POST', '/api/bottles/expedier', { blId: BData.bottleLot.id, count: 1, expeditionDate: new Date().toISOString(), clientName: 'Client Cross', idempotencyKey: `${PREFIX_A}-bexp-${RUN}` }, 'expédier BottleLot B depuis A'],
    ['POST', '/api/expeditions/vrac', { client: 'Client Cross', lines: [{ lotId: BData.vracLot.id, volumeHl: 1, mode: 'VRAC' }], idempotencyKey: `${PREFIX_A}-vrac-cross-${RUN}` }, 'expédition vrac lot B depuis A'],
    ['POST', '/api/expeditions/confirm-delivery', { type: 'BOTTLE', id: bExpeditionEvent.id }, 'confirmer expédition B depuis A'],
    ['PATCH', `/api/workorders/${BData.workOrder.publicId}`, { status: 'DONE', evidence: { run: RUN, cross: true } }, 'exécuter workOrder B depuis A'],
    ['POST', '/api/tracabilite', { type: 'bulk', lotCode: BData.genericLot.businessCode }, 'tracer lot B depuis A'],
  ];

  for (const [method, route, body, label] of refusalTests) {
    const before = await snapshot(refusalIds);
    const response = await api(method, route, { orgId: orgA.id, body });
    expectNotOkNo500(response, label);
    const after = await snapshot(refusalIds);
    verifyUnchanged(before, after, label);
    record('refusals', { label, method, route, status: response.status });
  }

  const validTransfer = await api('POST', '/api/transfers', {
    orgId: orgA.id,
    body: { lotId: AData.transferLot.id, fromId: AData.transferSourceContainer.id, destinations: [{ toId: AData.transferDestContainer.id, volume: 1 }], volume: 1, date: new Date().toISOString(), idempotencyKey: randomUUID(), note: 'valid A' },
  });
  expectOk(validTransfer, 'transfert valide A');
  record('validOperations', { label: 'transfert valide A', status: validTransfer.status });

  const validIntrant = await api('POST', '/api/lots/intrants', {
    orgId: orgA.id,
    body: { lotId: AData.intrantLot.id, intrant: 'Chaptalisation (Sucre)', quantity: 1, unit: 'kg', productId: AData.intrantProduct.id, note: 'valid A', idempotencyKey: `${PREFIX_A}-intrant-valid-${RUN}` },
  });
  expectOk(validIntrant, 'intrant valide A');
  record('validOperations', { label: 'intrant valide A', status: validIntrant.status });

  const validTirage = await api('POST', '/api/tirage', {
    orgId: orgA.id,
    body: {
      lotId: AData.tirageLot.id,
      sourceContainerId: AData.tirageContainer.id,
      format: '75cl',
      count: 1,
      volume: 0.008,
      bouchage: 'CAPSULE',
      zone: 'Codex',
      tirageDate: new Date().toISOString(),
      isTranquille: false,
      stockItems: [
        { productId: AData.bottleProduct.id, kind: 'PACKAGING_BOTTLE', quantity: 1, unit: 'unites', label: 'Bouteille A' },
        { productId: AData.capsuleProduct.id, kind: 'PACKAGING_PRIMARY_CLOSURE', quantity: 1, unit: 'unites', label: 'Capsule A' },
        { productId: AData.biduleProduct.id, kind: 'PACKAGING_SECONDARY_CLOSURE', quantity: 1, unit: 'unites', label: 'Bidule A' },
      ],
      calculatedItems: [],
      idempotencyKey: randomUUID(),
    },
  });
  expectOk(validTirage, 'tirage valide A');
  record('validOperations', { label: 'tirage valide A', status: validTirage.status });

  const validAssemblage = await api('POST', '/api/assemblages', {
    orgId: orgA.id,
    body: {
      code: `${PREFIX_A}-${RUN}-ASSEMB-VALID`,
      assemblageType: 'BSA',
      millesime: 'SA',
      components: [
        { sourceType: 'LOT', lotId: AData.assemblageMainLot.id, volumeHl: 1, sourceRole: 'MAIN' },
        { sourceType: 'LOT', lotId: AData.assemblageReserveLot.id, volumeHl: 1, sourceRole: 'RESERVE' },
      ],
      containerDestinationId: AData.assemblageDestContainer.id,
      idempotencyKey: `${PREFIX_A}-assemblage-valid-${RUN}`,
    },
  });
  expectOk(validAssemblage, 'assemblage valide A');
  record('validOperations', { label: 'assemblage valide A', status: validAssemblage.status });

  const validAnalysisA = await api('POST', '/api/analyses', {
    orgId: orgA.id,
    body: { analyses: [{ lotId: AData.genericLot.id, analysisDate: new Date().toISOString(), ph: 3.18, notes: `${PREFIX_A}-${RUN}-ANALYSE-API` }], idempotencyKey: `${PREFIX_A}-analysis-valid-${RUN}` },
  });
  expectOk(validAnalysisA, 'analyse valide A');
  record('validOperations', { label: 'analyse valide A', status: validAnalysisA.status });

  const validDegustationA = await api('POST', '/api/degustations', {
    orgId: orgA.id,
    body: { date: new Date().toISOString(), phase: 'VINS_CLAIRS', lotId: String(AData.genericLot.id), robe: 'clair', nez: 'valid A', bouche: 'valid A', idempotencyKey: `${PREFIX_A}-deg-valid-${RUN}` },
  });
  expectOk(validDegustationA, 'dégustation valide A');
  record('validOperations', { label: 'dégustation valide A', status: validDegustationA.status });

  const validFaA = await api('POST', '/api/fa', {
    orgId: orgA.id,
    body: { readings: [{ lotId: AData.genericLot.id, date: new Date().toISOString().slice(0, 10), density: 1000, temperature: 18 }], idempotencyKey: `${PREFIX_A}-fa-valid-${RUN}` },
  });
  expectOk(validFaA, 'FA valide A');
  record('validOperations', { label: 'FA valide A', status: validFaA.status });

  const validVracA = await api('POST', '/api/expeditions/vrac', {
    orgId: orgA.id,
    body: { client: 'Client A Codex', lines: [{ lotId: AData.vracLot.id, volumeHl: 1, mode: 'VRAC' }], idempotencyKey: `${PREFIX_A}-vrac-valid-${RUN}` },
  });
  expectOk(validVracA, 'expédition vrac valide A');
  record('validOperations', { label: 'expédition vrac valide A', status: validVracA.status });

  const validTransferB = await api('POST', '/api/transfers', {
    orgId: orgB.id,
    body: { lotId: BData.transferLot.id, fromId: BData.transferSourceContainer.id, destinations: [{ toId: BData.transferDestContainer.id, volume: 1 }], volume: 1, date: new Date().toISOString(), idempotencyKey: randomUUID(), note: 'valid B' },
  });
  expectOk(validTransferB, 'transfert valide B');
  record('validOperations', { label: 'transfert valide B', status: validTransferB.status });

  const validAnalysisB = await api('POST', '/api/analyses', {
    orgId: orgB.id,
    body: { analyses: [{ lotId: BData.genericLot.id, analysisDate: new Date().toISOString(), ph: 3.2, notes: `${PREFIX_B}-${RUN}-ANALYSE-API` }], idempotencyKey: `${PREFIX_B}-analysis-valid-${RUN}` },
  });
  expectOk(validAnalysisB, 'analyse valide B');
  record('validOperations', { label: 'analyse valide B', status: validAnalysisB.status });

  const workOrdersB = await api('GET', '/api/workorders', { orgId: orgB.id });
  expectOk(workOrdersB, 'workOrder B visible par B');
  assert(JSON.stringify(workOrdersB.body).includes(BData.workOrder.publicId), 'workOrder B absent côté B');
  assert(!JSON.stringify(workOrdersB.body).includes(AData.workOrder.publicId), 'workOrder A visible côté B');
  record('validOperations', { label: 'workOrder B visible seulement par B', status: workOrdersB.status });

  const auditChecks = await prisma.auditLog.groupBy({
    by: ['organizationId'],
    where: {
      organizationId: { in: [orgA.id, orgB.id] },
      createdAt: { gte: refusalSince },
    },
    _count: true,
  });
  report.auditLogsAfterApi = auditChecks;

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    reportPath: REPORT_PATH,
    organizations: report.organizations,
    refusals: report.refusals.length,
    validOperations: report.validOperations.length,
    reads: report.reads.length,
  }, null, 2));
}

main()
  .catch((error) => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ ...report, error: error.message }, null, 2)}\n`);
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
