import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();

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
Object.assign(process.env, env);

if (env.ALLOW_DEMO_TENANT_DATA !== 'true') {
  console.error('Script interrompu: définir ALLOW_DEMO_TENANT_DATA=true pour créer les données démo multi-tenant.');
  process.exit(1);
}

const prisma = new PrismaClient();
const PREFIX_A = 'DEMO-DOMAINE-A';
const PREFIX_B = 'DEMO-DOMAINE-B';

const accounts = {
  A: [
    { roleKey: 'ADMIN', email: env.E2E_ADMIN_A_EMAIL || 'admin-a@cave.test', password: env.E2E_ADMIN_A_PASSWORD },
    { roleKey: 'CHEF_CAVE', email: env.E2E_CHEF_A_EMAIL || 'chef-a@cave.test', password: env.E2E_CHEF_A_PASSWORD },
    { roleKey: 'CAVISTE', email: env.E2E_CAVISTE_A_EMAIL || 'caviste-a@cave.test', password: env.E2E_CAVISTE_A_PASSWORD },
    { roleKey: 'LECTURE_SEULE', email: env.E2E_LECTURE_A_EMAIL || env.E2E_READONLY_A_EMAIL || 'lecture-a@cave.test', password: env.E2E_LECTURE_A_PASSWORD || env.E2E_READONLY_A_PASSWORD },
  ],
  B: [
    { roleKey: 'ADMIN', email: env.E2E_ADMIN_B_EMAIL || 'admin-b@cave.test', password: env.E2E_ADMIN_B_PASSWORD },
    { roleKey: 'CHEF_CAVE', email: env.E2E_CHEF_B_EMAIL || 'chef-b@cave.test', password: env.E2E_CHEF_B_PASSWORD },
    { roleKey: 'CAVISTE', email: env.E2E_CAVISTE_B_EMAIL || 'caviste-b@cave.test', password: env.E2E_CAVISTE_B_PASSWORD },
    { roleKey: 'LECTURE_SEULE', email: env.E2E_LECTURE_B_EMAIL || env.E2E_READONLY_B_EMAIL || 'lecture-b@cave.test', password: env.E2E_LECTURE_B_PASSWORD || env.E2E_READONLY_B_PASSWORD },
  ],
};

const orgSlugCandidates = {
  A: [env.DEMO_ORG_A_SLUG, env.E2E_ORG_A_SLUG, 'domaine-des-aulnes', 'organisation-a', 'org-a', 'test-org-a-codex'].filter(Boolean),
  B: [env.DEMO_ORG_B_SLUG, env.E2E_ORG_B_SLUG, 'clos-des-brumes', 'organisation-b', 'org-b', 'test-org-b-codex'].filter(Boolean),
};

const orgDisplayNames = {
  A: 'Domaine des Aulnes',
  B: 'Clos des Brumes',
};

const d = (value) => new Prisma.Decimal(String(value));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const summary = {
  organizations: {},
  memberships: { A: [], B: [] },
  created: { A: {}, B: {} },
  reused: { A: {}, B: {} },
  checks: [],
  apiChecks: [],
  warnings: [],
};

const bump = (bucket, orgKey, model) => {
  bucket[orgKey][model] = (bucket[orgKey][model] ?? 0) + 1;
};

const redactOrg = (org) => ({ id: org.id, name: org.name, slug: org.slug });

const findOrganizationByUsers = async (orgKey) => {
  const emails = accounts[orgKey].map((account) => account.email);
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { memberships: { include: { organization: true } } },
    orderBy: { email: 'asc' },
  });

  for (const user of users) {
    assert(
      user.memberships.length <= 1,
      `Utilisateur ${user.email} rattaché à plusieurs organisations. Configuration non autorisée.`,
    );
  }

  const organizationIds = new Set(users.flatMap((user) => user.memberships.map((membership) => membership.organizationId)));
  assert(organizationIds.size <= 1, `Les utilisateurs de l'organisation ${orgKey} pointent vers plusieurs organisations.`);

  return users.find((user) => user.memberships[0])?.memberships[0]?.organization ?? null;
};

const findOrganizationBySlug = async (orgKey) => {
  for (const slug of orgSlugCandidates[orgKey]) {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (org) return org;
  }
  return null;
};

const resolveOrganization = async (orgKey) => {
  const byUser = await findOrganizationByUsers(orgKey);
  if (byUser) return byUser;
  return findOrganizationBySlug(orgKey);
};

const ensureOrganizationDisplayName = async (orgKey, org) => {
  const expectedName = orgDisplayNames[orgKey];
  if (!expectedName || org.name === expectedName) return org;
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { name: expectedName },
  });
  summary.checks.push({ label: `Nom metier organisation ${orgKey}`, previous: org.name, actual: updated.name });
  return updated;
};

const verifyMemberships = async (orgKey, orgId) => {
  const rows = [];
  for (const account of accounts[orgKey]) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: account.email, mode: 'insensitive' } },
      include: { memberships: true },
    });

    if (!user) {
      summary.warnings.push(`Utilisateur DB absent pour ${account.email}; organisation ${orgKey} résolue par slug.`);
      continue;
    }

    assert(user.memberships.length <= 1, `Utilisateur ${account.email} rattaché à plusieurs organisations.`);
    assert(
      user.memberships.length === 0 || user.memberships[0].organizationId === orgId,
      `Utilisateur ${account.email} rattaché à une autre organisation que ${orgKey}.`,
    );
    rows.push({ email: user.email, userId: user.id, organizationId: user.memberships[0]?.organizationId ?? null, roleKey: user.memberships[0]?.roleKey ?? user.roleKey });
  }
  summary.memberships[orgKey] = rows;
};

const ensureByUnique = async (orgKey, model, find, create, update = {}) => {
  const existing = await prisma[model].findUnique(find);
  if (existing) {
    const updated = Object.keys(update).length
      ? await prisma[model].update({ where: find.where, data: update })
      : existing;
    bump(summary.reused, orgKey, model);
    return updated;
  }
  const created = await prisma[model].create({ data: create });
  bump(summary.created, orgKey, model);
  return created;
};

const ensureFirst = async (orgKey, model, where, create, update = {}) => {
  const existing = await prisma[model].findFirst({ where });
  if (existing) {
    const updated = Object.keys(update).length
      ? await prisma[model].update({ where: { id: existing.id }, data: update })
      : existing;
    bump(summary.reused, orgKey, model);
    return updated;
  }
  const created = await prisma[model].create({ data: create });
  bump(summary.created, orgKey, model);
  return created;
};

const ensureParcelle = (orgKey, orgId, item) => ensureFirst(
  orgKey,
  'parcelle',
  { organizationId: orgId, nom: item.nom },
  {
    organizationId: orgId,
    nom: item.nom,
    departement: item.departement,
    region: item.region,
    commune: item.commune,
  },
  {
    departement: item.departement,
    region: item.region,
    commune: item.commune,
  },
);

const ensurePressoir = (orgKey, orgId, item) => ensureFirst(
  orgKey,
  'pressoir',
  { organizationId: orgId, nom: item.nom },
  {
    organizationId: orgId,
    nom: item.nom,
    type: item.type,
    marque: item.marque,
    capacite: item.capacite,
    status: item.status,
  },
  {
    type: item.type,
    marque: item.marque,
    capacite: item.capacite,
    status: item.status,
  },
);

const ensureContainer = (orgKey, orgId, item) => ensureByUnique(
  orgKey,
  'container',
  { where: { code: item.code } },
  {
    organizationId: orgId,
    code: item.code,
    displayName: item.displayName,
    type: item.type,
    capacityValue: d(item.capacityValue),
    capacityUnit: 'hL',
    site: item.site,
    zone: item.zone,
    status: item.status,
    notes: item.notes,
  },
  {
    organizationId: orgId,
    displayName: item.displayName,
    type: item.type,
    capacityValue: d(item.capacityValue),
    capacityUnit: 'hL',
    site: item.site,
    zone: item.zone,
    status: item.status,
    notes: item.notes,
  },
);

const ensureLot = async (orgKey, orgId, item) => {
  const lot = await ensureByUnique(
    orgKey,
    'lot',
    { where: { businessCode: item.businessCode } },
    {
      organizationId: orgId,
      technicalCode: `${item.businessCode}-TECH`,
      businessCode: item.businessCode,
      year: item.year,
      mainGrapeCode: item.mainGrapeCode,
      placeCode: item.placeCode,
      sequenceNumber: item.sequenceNumber,
      status: item.status,
      currentVolume: d(item.currentVolume),
      currentVolumeUnit: 'hL',
      currentContainerId: item.currentContainerId,
      qualiteLot: item.qualiteLot,
      notes: item.notes,
    },
    {
      organizationId: orgId,
      year: item.year,
      mainGrapeCode: item.mainGrapeCode,
      placeCode: item.placeCode,
      sequenceNumber: item.sequenceNumber,
      status: item.status,
      currentVolume: d(item.currentVolume),
      currentVolumeUnit: 'hL',
      currentContainerId: item.currentContainerId,
      qualiteLot: item.qualiteLot,
      notes: item.notes,
    },
  );

  await ensureFirst(
    orgKey,
    'lotComponent',
    { lotId: lot.id, grapeCode: item.mainGrapeCode },
    { lotId: lot.id, grapeCode: item.mainGrapeCode, percentage: d(100) },
    { percentage: d(100) },
  );

  return lot;
};

const ensureProduct = async (orgKey, orgId, item) => {
  const product = await ensureFirst(
    orgKey,
    'product',
    { organizationId: orgId, name: item.name },
    {
      organizationId: orgId,
      name: item.name,
      category: item.category,
      subCategory: item.subCategory,
      unit: item.unit,
      minStock: d(item.minStock),
      currentStock: d(item.currentStock),
    },
    {
      category: item.category,
      subCategory: item.subCategory,
      unit: item.unit,
      minStock: d(item.minStock),
      currentStock: d(item.currentStock),
    },
  );

  await ensureFirst(
    orgKey,
    'stockMovement',
    { organizationId: orgId, productId: product.id, note: `${item.name} - stock initial demo` },
    {
      organizationId: orgId,
      productId: product.id,
      type: 'IN',
      quantity: d(item.currentStock),
      note: `${item.name} - stock initial demo`,
      operator: 'Script demo tenant',
    },
  );

  return product;
};

const ensureAnalysis = (orgKey, orgId, item) => ensureFirst(
  orgKey,
  'analysis',
  { organizationId: orgId, lotId: item.lotId, notes: item.notes },
  {
    organizationId: orgId,
    lotId: item.lotId,
    analysisDate: item.analysisDate,
    ph: item.ph,
    at: item.at,
    so2Free: item.so2Free,
    so2Total: item.so2Total,
    alcohol: item.alcohol,
    notes: item.notes,
    extraData: item.extraData,
  },
);

const ensureDegustation = (orgKey, orgId, item) => ensureFirst(
  orgKey,
  'degustation',
  { organizationId: orgId, phase: item.phase, lotId: item.lotId, notes: item.notes },
  {
    organizationId: orgId,
    date: item.date,
    phase: item.phase,
    lotId: item.lotId,
    robe: item.robe,
    nez: item.nez,
    bouche: item.bouche,
    noteGlobale: item.noteGlobale,
    operator: item.operator,
    notes: item.notes,
  },
);

const ensureFaReading = (orgKey, orgId, item) => ensureFirst(
  orgKey,
  'faReading',
  { organizationId: orgId, lotId: item.lotId, date: item.date, operator: item.operator },
  {
    organizationId: orgId,
    lotId: item.lotId,
    date: item.date,
    density: item.density,
    temperature: item.temperature,
    operator: item.operator,
  },
  {
    density: item.density,
    temperature: item.temperature,
  },
);

const ensureWorkOrder = (orgKey, orgId, item) => ensureByUnique(
  orgKey,
  'workOrder',
  { where: { publicId: item.publicId } },
  {
    organizationId: orgId,
    publicId: item.publicId,
    recette: item.recette,
    status: 'PENDING',
    targetContainerId: item.targetContainerId,
    targetLotId: item.targetLotId,
    details: item.details,
    sources: item.sources,
    plannedVolume: d(item.plannedVolume),
    createdBy: item.createdBy,
    operator: item.operator,
  },
  {
    organizationId: orgId,
    recette: item.recette,
    status: 'PENDING',
    targetContainerId: item.targetContainerId,
    targetLotId: item.targetLotId,
    details: item.details,
    sources: item.sources,
    plannedVolume: d(item.plannedVolume),
    createdBy: item.createdBy,
    operator: item.operator,
  },
);

const ensureLotEvent = async (orgKey, orgId, item) => {
  const event = await ensureFirst(
    orgKey,
    'lotEvent',
    { organizationId: orgId, eventType: item.eventType, comment: item.comment },
    {
      organizationId: orgId,
      eventType: item.eventType,
      eventDatetime: item.eventDatetime,
      operatorUserId: item.operatorUserId,
      comment: item.comment,
      metadata: item.metadata,
    },
  );

  if (item.lotId) {
    await ensureFirst(
      orgKey,
      'lotEventLot',
      { eventId: event.id, lotId: item.lotId, roleInEvent: item.roleInEvent },
      { eventId: event.id, lotId: item.lotId, roleInEvent: item.roleInEvent, volumeChange: d(item.volumeChange), unit: 'hL' },
    );
  }

  return event;
};

const ensureAuditLog = (orgKey, orgId, item) => ensureFirst(
  orgKey,
  'auditLog',
  { organizationId: orgId, action: item.action, details: item.details },
  {
    organizationId: orgId,
    action: item.action,
    details: item.details,
    userId: item.userId,
  },
);

const adminUserFor = async (orgKey, orgId) => {
  const adminEmail = accounts[orgKey][0].email;
  const user = await prisma.user.findFirst({ where: { email: { equals: adminEmail, mode: 'insensitive' } } });
  if (user) return user;

  const fallback = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId },
    include: { user: true },
    orderBy: { id: 'asc' },
  });
  if (fallback?.user) return fallback.user;

  return prisma.user.findFirst({ orderBy: { id: 'asc' } });
};

const createDataA = async (org) => {
  const orgKey = 'A';
  const orgId = org.id;
  const prefix = PREFIX_A;
  const admin = await adminUserFor(orgKey, orgId);
  assert(admin, 'Aucun utilisateur disponible pour créer les événements Organisation A.');

  const parcelles = await Promise.all([
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Les Crayeres`, commune: 'Cramant', departement: 'Marne', region: 'Champagne' }),
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Les Marnes Blanches`, commune: 'Avize', departement: 'Marne', region: 'Champagne' }),
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Les Pres Meunier`, commune: 'Venteuil', departement: 'Marne', region: 'Champagne' }),
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Coteau Saint-Vincent`, commune: 'Ambonnay', departement: 'Marne', region: 'Champagne' }),
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Les Vaux Dores`, commune: 'Bouzy', departement: 'Marne', region: 'Champagne' }),
  ]);

  const pressoir = await ensurePressoir(orgKey, orgId, {
    nom: `${prefix}-PRESSOIR-4000 - Pressoir principal`,
    type: 'Pneumatique',
    marque: 'Demo pneumatique 4000 kg',
    capacite: 4000,
    status: 'VIDE',
  });

  const cuveCapacities = [20, 25, 30, 30, 40, 40, 50, 60, 80, 100];
  const cuves = [];
  for (let index = 0; index < cuveCapacities.length; index += 1) {
    const code = `${prefix}-CUVE-${String(index + 1).padStart(2, '0')}`;
    cuves.push(await ensureContainer(orgKey, orgId, {
      code,
      displayName: `${code} - Cuve inox ${cuveCapacities[index]} hL`,
      type: 'CUVE_INOX',
      capacityValue: cuveCapacities[index],
      site: 'Domaine des Aulnes',
      zone: 'Cuverie principale',
      status: index < 8 ? 'PLEIN' : 'VIDE',
      notes: `${prefix} - cuve inox demo`,
    }));
  }

  const futs = [];
  for (let index = 0; index < 3; index += 1) {
    const code = `${prefix}-FUT-${String(index + 1).padStart(2, '0')}`;
    futs.push(await ensureContainer(orgKey, orgId, {
      code,
      displayName: `${code} - Fut chene 2.28 hL`,
      type: 'FUT_CHENE',
      capacityValue: 2.28,
      site: 'Domaine des Aulnes',
      zone: 'Chai a futs',
      status: index === 0 ? 'PLEIN' : 'VIDE',
      notes: `${prefix} - reserve / elevage`,
    }));
  }

  const lots = {
    crayeres: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-CH-CRAYERES-2026`,
      year: 2026,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-PARCELLE-CRAYERES`,
      sequenceNumber: 260101,
      status: 'MOUT_DEBOURBE',
      currentVolume: 18,
      currentContainerId: cuves[0].id,
      qualiteLot: 'MOUT',
      notes: 'Les Crayeres, Chardonnay, sol crayeux, maturite precoce.',
    }),
    marnes: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-CH-MARNES-2026`,
      year: 2026,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-PARCELLE-MARNES`,
      sequenceNumber: 260102,
      status: 'FERMENTATION_ALCOOLIQUE',
      currentVolume: 22,
      currentContainerId: cuves[1].id,
      qualiteLot: 'MOUT',
      notes: 'Les Marnes Blanches, Chardonnay, fermentation reguliere.',
    }),
    meunier: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-MEUNIER-PRES-2026`,
      year: 2026,
      mainGrapeCode: 'PM',
      placeCode: `${prefix}-PARCELLE-MEUNIER`,
      sequenceNumber: 260103,
      status: 'FERMENTATION_ALCOOLIQUE',
      currentVolume: 27,
      currentContainerId: cuves[2].id,
      qualiteLot: 'MOUT',
      notes: 'Les Pres Meunier, profil fruit blanc.',
    }),
    coteau: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-PN-COTEAU-2026`,
      year: 2026,
      mainGrapeCode: 'PN',
      placeCode: `${prefix}-PARCELLE-COTEAU`,
      sequenceNumber: 260104,
      status: 'VIN_DE_BASE',
      currentVolume: 28,
      currentContainerId: cuves[3].id,
      qualiteLot: 'VIN_CLAIR',
      notes: 'Coteau Saint-Vincent, Pinot Noir structure.',
    }),
    vaux: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-PN-VAUX-2026`,
      year: 2026,
      mainGrapeCode: 'PN',
      placeCode: `${prefix}-PARCELLE-VAUX`,
      sequenceNumber: 260105,
      status: 'VIN_DE_BASE',
      currentVolume: 36,
      currentContainerId: cuves[4].id,
      qualiteLot: 'VIN_CLAIR',
      notes: 'Les Vaux Dores, Pinot Noir souple.',
    }),
    reserve: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-RESERVE-CH-2025`,
      year: 2025,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-RESERVE`,
      sequenceNumber: 250101,
      status: 'RESERVE',
      currentVolume: 2.1,
      currentContainerId: futs[0].id,
      qualiteLot: 'RESERVE',
      notes: 'Reserve Chardonnay 2025 en fut chene.',
    }),
    assemblage: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-ASSEMBLAGE-BSA`,
      year: 2026,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-ASSEMBLAGE`,
      sequenceNumber: 260201,
      status: 'ASSEMBLAGE',
      currentVolume: 34,
      currentContainerId: cuves[5].id,
      qualiteLot: 'ASSEMBLAGE',
      notes: 'Support assemblage BSA: Chardonnay majoritaire, reserve en appoint.',
    }),
    tirage: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-TIRAGE-BASE`,
      year: 2026,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-TIRAGE`,
      sequenceNumber: 260202,
      status: 'VIN_DE_BASE',
      currentVolume: 45,
      currentContainerId: cuves[6].id,
      qualiteLot: 'PRET_TIRAGE',
      notes: 'Lot pret pour tirage, filtration prevue.',
    }),
  };

  const products = [
    ['BOUTEILLES-75CL', 'Matieres seches', 'Bouteilles', 'unites', 15000, 2500],
    ['CAPSULES', 'Matieres seches', 'Capsules', 'unites', 18000, 3000],
    ['BIDULES', 'Matieres seches', 'Bidules', 'unites', 18000, 3000],
    ['SUCRE-TIRAGE', 'Intrants', 'Sucre de tirage', 'kg', 120, 30],
    ['LEVURES-PRISE-MOUSSE', 'Intrants', 'Levures', 'kg', 8, 2],
    ['BENTONITE', 'Intrants', 'Clarification', 'kg', 15, 3],
    ['NUTRIMENT-FA', 'Intrants', 'Nutrition FA', 'kg', 10, 2],
    ['SO2', 'Intrants', 'Protection', 'kg', 6, 1],
    ['ADJUVANT-REMUAGE', 'Intrants', 'Remuage', 'kg', 5, 1],
  ];
  for (const [suffix, category, subCategory, unit, currentStock, minStock] of products) {
    await ensureProduct(orgKey, orgId, { name: `${prefix}-${suffix}`, category, subCategory, unit, currentStock, minStock });
  }

  await ensureAnalysis(orgKey, orgId, { lotId: lots.marnes.id, analysisDate: new Date('2026-09-18T08:00:00.000Z'), ph: 3.12, at: 7.1, so2Free: 12, so2Total: 45, alcohol: 5.2, notes: `${prefix}-ANALYSE-CH-MARNES`, extraData: { density: 1042, malic: 3.4 } });
  await ensureAnalysis(orgKey, orgId, { lotId: lots.coteau.id, analysisDate: new Date('2026-10-08T08:00:00.000Z'), ph: 3.18, at: 6.4, so2Free: 18, so2Total: 62, alcohol: 10.8, notes: `${prefix}-ANALYSE-PN-COTEAU`, extraData: { malo: 'non declenchee' } });
  await ensureAnalysis(orgKey, orgId, { lotId: lots.tirage.id, analysisDate: new Date('2026-11-15T08:00:00.000Z'), ph: 3.09, at: 6.8, so2Free: 22, so2Total: 78, alcohol: 10.6, notes: `${prefix}-ANALYSE-TIRAGE-BASE`, extraData: { stability: 'ok tirage' } });

  await ensureDegustation(orgKey, orgId, { date: new Date('2026-10-12T09:00:00.000Z'), phase: 'VINS_CLAIRS', lotId: String(lots.coteau.id), robe: 'or pale', nez: 'fruits rouges discrets', bouche: 'droite et structuree', noteGlobale: 15.5, operator: accounts.A[1].email, notes: `${prefix}-DEGUSTATION-PN-COTEAU` });
  await ensureDegustation(orgKey, orgId, { date: new Date('2026-11-20T09:00:00.000Z'), phase: 'VINS_CLAIRS', lotId: String(lots.assemblage.id), robe: 'jaune clair', nez: 'agrumes et fleurs blanches', bouche: 'equilibree, finale crayeuse', noteGlobale: 16, operator: accounts.A[1].email, notes: `${prefix}-DEGUSTATION-ASSEMBLAGE-BSA` });

  await ensureFaReading(orgKey, orgId, { lotId: lots.meunier.id, date: '2026-09-16', density: 1065, temperature: 18.2, operator: accounts.A[2].email });
  await ensureFaReading(orgKey, orgId, { lotId: lots.meunier.id, date: '2026-09-18', density: 1038, temperature: 18.6, operator: accounts.A[2].email });
  await ensureFaReading(orgKey, orgId, { lotId: lots.meunier.id, date: '2026-09-21', density: 1008, temperature: 18.1, operator: accounts.A[2].email });

  await ensureWorkOrder(orgKey, orgId, { publicId: `${prefix}-WO-SOUTIRAGE-01`, recette: 'SOUTIRAGE', targetContainerId: cuves[7].id, targetLotId: lots.coteau.id, details: 'Soutirage doux du Pinot Noir Coteau vers cuve 08.', sources: [{ lotId: lots.coteau.id, volume: 28, role: 'SOURCE' }], plannedVolume: 28, createdBy: accounts.A[1].email, operator: accounts.A[2].email });
  await ensureWorkOrder(orgKey, orgId, { publicId: `${prefix}-WO-INTRANT-01`, recette: 'INTRANT', targetContainerId: cuves[1].id, targetLotId: lots.marnes.id, details: 'Apport nutriment FA modere sur Chardonnay Marnes.', sources: [{ lotId: lots.marnes.id, volume: 22, role: 'CIBLE' }], plannedVolume: 22, createdBy: accounts.A[1].email, operator: accounts.A[2].email });
  await ensureWorkOrder(orgKey, orgId, { publicId: `${prefix}-WO-TIRAGE-01`, recette: 'PREPARATION_TIRAGE', targetContainerId: cuves[6].id, targetLotId: lots.tirage.id, details: 'Controle final et preparation du lot de base tirage.', sources: [{ lotId: lots.tirage.id, volume: 45, role: 'CIBLE' }], plannedVolume: 45, createdBy: accounts.A[1].email, operator: accounts.A[2].email });

  await ensureLotEvent(orgKey, orgId, { eventType: 'DEMO_CREATION_LOT', eventDatetime: new Date('2026-09-15T07:30:00.000Z'), operatorUserId: admin.id, comment: `${prefix}-EVENT-CREATION-CH-CRAYERES`, metadata: { prefix, domaine: 'Domaine des Aulnes' }, lotId: lots.crayeres.id, roleInEvent: 'CIBLE', volumeChange: 18 });
  await ensureAuditLog(orgKey, orgId, { action: 'DEMO_TENANT_DATA', details: `${prefix} - creation ou verification du jeu de donnees Domaine des Aulnes`, userId: accounts.A[0].email });

  return { parcelles, pressoir, cuves, futs, lots };
};

const createDataB = async (org) => {
  const orgKey = 'B';
  const orgId = org.id;
  const prefix = PREFIX_B;
  const admin = await adminUserFor(orgKey, orgId);
  assert(admin, 'Aucun utilisateur disponible pour créer les événements Organisation B.');

  const parcelles = await Promise.all([
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Le Clos`, commune: 'Hautvillers', departement: 'Marne', region: 'Champagne' }),
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - La Roseraie`, commune: 'Damery', departement: 'Marne', region: 'Champagne' }),
    ensureParcelle(orgKey, orgId, { nom: `${prefix} - Les Petits Noirs`, commune: 'Cumieres', departement: 'Marne', region: 'Champagne' }),
  ]);

  const cuves = [];
  for (const [index, capacity] of [10, 15].entries()) {
    const code = `${prefix}-CUVE-${String(index + 1).padStart(2, '0')}`;
    cuves.push(await ensureContainer(orgKey, orgId, {
      code,
      displayName: `${code} - Cuve inox ${capacity} hL`,
      type: 'CUVE_INOX',
      capacityValue: capacity,
      site: 'Clos des Brumes',
      zone: 'Petite cuverie',
      status: 'PLEIN',
      notes: `${prefix} - jus recus apres pressurage externe`,
    }));
  }

  const futs = [];
  for (let index = 0; index < 6; index += 1) {
    const code = `${prefix}-FUT-${String(index + 1).padStart(2, '0')}`;
    futs.push(await ensureContainer(orgKey, orgId, {
      code,
      displayName: `${code} - Fut chene 2.28 hL`,
      type: 'FUT_CHENE',
      capacityValue: 2.28,
      site: 'Clos des Brumes',
      zone: 'Chai a futs',
      status: index < 2 ? 'PLEIN' : 'VIDE',
      notes: `${prefix} - elevage parcellaire / reserve`,
    }));
  }

  const lots = {
    jusCh: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-JUS-CH-2026`,
      year: 2026,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-PARCELLE-CLOS`,
      sequenceNumber: 260301,
      status: 'MOUT_DEBOURBE',
      currentVolume: 9,
      currentContainerId: cuves[0].id,
      qualiteLot: 'MOUT',
      notes: 'Jus Chardonnay recu apres pressurage externe. Le Clos, 1.2 ha.',
    }),
    jusMeunier: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-JUS-MEUNIER-2026`,
      year: 2026,
      mainGrapeCode: 'PM',
      placeCode: `${prefix}-PARCELLE-ROSERAIE`,
      sequenceNumber: 260302,
      status: 'FERMENTATION_ALCOOLIQUE',
      currentVolume: 13,
      currentContainerId: cuves[1].id,
      qualiteLot: 'MOUT',
      notes: 'Jus Meunier recu apres pressurage externe. La Roseraie, 1.0 ha.',
    }),
    futPn: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-FUT-PN-2026`,
      year: 2026,
      mainGrapeCode: 'PN',
      placeCode: `${prefix}-PARCELLE-NOIRS`,
      sequenceNumber: 260303,
      status: 'VIN_DE_BASE',
      currentVolume: 2,
      currentContainerId: futs[0].id,
      qualiteLot: 'VIN_CLAIR',
      notes: 'Pinot Noir en fut, jus issu de pressurage externe.',
    }),
    reserveFut: await ensureLot(orgKey, orgId, {
      businessCode: `${prefix}-RESERVE-FUT-2025`,
      year: 2025,
      mainGrapeCode: 'CH',
      placeCode: `${prefix}-RESERVE`,
      sequenceNumber: 250301,
      status: 'RESERVE',
      currentVolume: 1.8,
      currentContainerId: futs[1].id,
      qualiteLot: 'RESERVE',
      notes: 'Reserve artisanale en fut, utilisee en appoint assemblage.',
    }),
  };

  const products = [
    ['BOUTEILLES-75CL', 'Matieres seches', 'Bouteilles', 'unites', 3500, 800],
    ['CAPSULES', 'Matieres seches', 'Capsules', 'unites', 4000, 1000],
    ['BIDULES', 'Matieres seches', 'Bidules', 'unites', 4000, 1000],
    ['SO2', 'Intrants', 'Protection', 'kg', 2, 0.5],
    ['NUTRIMENT-FA', 'Intrants', 'Nutrition FA', 'kg', 3, 0.5],
    ['LEVURES', 'Intrants', 'Levures', 'kg', 2, 0.5],
    ['BENTONITE', 'Intrants', 'Clarification', 'kg', 4, 1],
  ];
  for (const [suffix, category, subCategory, unit, currentStock, minStock] of products) {
    await ensureProduct(orgKey, orgId, { name: `${prefix}-${suffix}`, category, subCategory, unit, currentStock, minStock });
  }

  await ensureAnalysis(orgKey, orgId, { lotId: lots.jusCh.id, analysisDate: new Date('2026-09-19T08:00:00.000Z'), ph: 3.16, at: 7.4, so2Free: 10, so2Total: 38, alcohol: 4.8, notes: `${prefix}-ANALYSE-JUS-CH`, extraData: { origine: 'pressurage externe' } });
  await ensureAnalysis(orgKey, orgId, { lotId: lots.jusMeunier.id, analysisDate: new Date('2026-09-20T08:00:00.000Z'), ph: 3.22, at: 6.9, so2Free: 9, so2Total: 35, alcohol: 5.6, notes: `${prefix}-ANALYSE-JUS-MEUNIER`, extraData: { origine: 'pressurage externe' } });
  await ensureDegustation(orgKey, orgId, { date: new Date('2026-10-18T09:00:00.000Z'), phase: 'FERMENTATION', lotId: String(lots.jusMeunier.id), robe: 'trouble fermentation', nez: 'poire et pomme fraiche', bouche: 'fermentation active, propre', noteGlobale: 14.5, operator: accounts.B[1].email, notes: `${prefix}-DEGUSTATION-JUS-MEUNIER` });

  await ensureFaReading(orgKey, orgId, { lotId: lots.jusMeunier.id, date: '2026-09-17', density: 1058, temperature: 18, operator: accounts.B[2].email });
  await ensureFaReading(orgKey, orgId, { lotId: lots.jusMeunier.id, date: '2026-09-20', density: 1022, temperature: 18.3, operator: accounts.B[2].email });

  await ensureWorkOrder(orgKey, orgId, { publicId: `${prefix}-WO-SOUTIRAGE-FUT-01`, recette: 'SOUTIRAGE_FUT', targetContainerId: futs[2].id, targetLotId: lots.futPn.id, details: 'Soutirage du Pinot Noir en fut vers fut propre.', sources: [{ lotId: lots.futPn.id, volume: 2, role: 'SOURCE' }], plannedVolume: 2, createdBy: accounts.B[1].email, operator: accounts.B[2].email });
  await ensureWorkOrder(orgKey, orgId, { publicId: `${prefix}-WO-INTRANT-LEGER-01`, recette: 'INTRANT', targetContainerId: cuves[1].id, targetLotId: lots.jusMeunier.id, details: 'Apport leger de nutriment FA sur jus Meunier.', sources: [{ lotId: lots.jusMeunier.id, volume: 13, role: 'CIBLE' }], plannedVolume: 13, createdBy: accounts.B[1].email, operator: accounts.B[2].email });

  await ensureLotEvent(orgKey, orgId, { eventType: 'DEMO_RECEPTION_JUS', eventDatetime: new Date('2026-09-14T07:30:00.000Z'), operatorUserId: admin.id, comment: `${prefix}-EVENT-RECEPTION-JUS-EXTERNE`, metadata: { prefix, domaine: 'Clos des Brumes', origine: 'pressurage externe' }, lotId: lots.jusCh.id, roleInEvent: 'CIBLE', volumeChange: 9 });
  await ensureAuditLog(orgKey, orgId, { action: 'DEMO_TENANT_DATA', details: `${prefix} - creation ou verification du jeu de donnees Clos des Brumes`, userId: accounts.B[0].email });

  return { parcelles, cuves, futs, lots };
};

const verifyDataIsolation = async (orgA, orgB) => {
  const checks = [
    ['A lots', await prisma.lot.count({ where: { organizationId: orgA.id, businessCode: { startsWith: PREFIX_A } } }), 8],
    ['B lots', await prisma.lot.count({ where: { organizationId: orgB.id, businessCode: { startsWith: PREFIX_B } } }), 4],
    ['A containers', await prisma.container.count({ where: { organizationId: orgA.id, code: { startsWith: PREFIX_A } } }), 13],
    ['B containers', await prisma.container.count({ where: { organizationId: orgB.id, code: { startsWith: PREFIX_B } } }), 8],
    ['A pressoirs', await prisma.pressoir.count({ where: { organizationId: orgA.id, nom: { startsWith: PREFIX_A } } }), 1],
    ['B pressoirs', await prisma.pressoir.count({ where: { organizationId: orgB.id, nom: { startsWith: PREFIX_B } } }), 0],
    ['A products', await prisma.product.count({ where: { organizationId: orgA.id, name: { startsWith: PREFIX_A } } }), 9],
    ['B products', await prisma.product.count({ where: { organizationId: orgB.id, name: { startsWith: PREFIX_B } } }), 7],
    ['A sees no B lots', await prisma.lot.count({ where: { organizationId: orgA.id, businessCode: { startsWith: PREFIX_B } } }), 0],
    ['B sees no A lots', await prisma.lot.count({ where: { organizationId: orgB.id, businessCode: { startsWith: PREFIX_A } } }), 0],
  ];

  for (const [label, actual, expected] of checks) {
    assert(actual === expected, `${label}: attendu ${expected}, obtenu ${actual}.`);
    summary.checks.push({ label, actual, expected });
  }

  const scopedTables = [
    ['containers', 'code'],
    ['lots', 'business_code'],
    ['analyses', 'notes'],
    ['lot_events', 'comment'],
    ['fa_readings', 'operator'],
    ['Parcelle', 'nom'],
    ['Degustation', 'notes'],
    ['Pressoir', 'nom'],
    ['products', 'name'],
    ['stock_movements', 'note'],
    ['audit_logs', 'details'],
    ['work_orders', 'public_id'],
  ];

  for (const [table, markerColumn] of scopedTables) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "${markerColumn}" LIKE $1 AND "organization_id" IS NULL`,
      'DEMO-DOMAINE-%',
    );
    assert(rows[0].count === 0, `${table}: donnée demo sans organization_id.`);
  }
  summary.checks.push({ label: 'Aucune donnee demo scopee sans organization_id', actual: 0, expected: 0 });
};

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 400) };
  }
};

const optionalApiChecks = async (orgA, orgB) => {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrl = env.E2E_BASE_URL || 'http://localhost:3000';
  const adminA = accounts.A[0];
  const adminB = accounts.B[0];

  if (!supabaseUrl || !supabaseAnonKey || !adminA.password || !adminB.password) {
    summary.warnings.push('Verification API ignoree: variables Supabase ou mots de passe E2E admin absents.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = async (account) => {
    const result = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
    if (result.error || !result.data.session?.access_token) {
      summary.warnings.push(`Verification API ignoree pour ${account.email}: connexion impossible.`);
      return null;
    }
    return result.data.session.access_token;
  };

  const tokenA = await signIn(adminA);
  const tokenB = await signIn(adminB);
  if (!tokenA || !tokenB) return;

  const requestApi = async (token, route, organizationHeaderId) => {
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    if (organizationHeaderId) headers['x-organization-id'] = String(organizationHeaderId);
    const response = await fetch(`${baseUrl}${route}`, { headers });
    return { status: response.status, body: await safeJson(response) };
  };

  let meA;
  let meB;
  try {
    meA = await requestApi(tokenA, '/api/me');
    meB = await requestApi(tokenB, '/api/me');
  } catch (error) {
    summary.warnings.push(`Verification API ignoree: serveur applicatif indisponible (${error.message}).`);
    return;
  }
  assert(meA.status === 200 && meA.body?.organization?.id === orgA.id, '/api/me admin A ne retourne pas la bonne organisation.');
  assert(meB.status === 200 && meB.body?.organization?.id === orgB.id, '/api/me admin B ne retourne pas la bonne organisation.');
  summary.apiChecks.push({ label: '/api/me admin A', status: meA.status, organizationId: meA.body.organization.id });
  summary.apiChecks.push({ label: '/api/me admin B', status: meB.status, organizationId: meB.body.organization.id });

  const lotsA = await requestApi(tokenA, '/api/lots');
  const lotsB = await requestApi(tokenB, '/api/lots');
  const textA = JSON.stringify(lotsA.body);
  const textB = JSON.stringify(lotsB.body);
  assert(lotsA.status === 200 && textA.includes(PREFIX_A) && !textA.includes(PREFIX_B), 'Isolation lots admin A incorrecte.');
  assert(lotsB.status === 200 && textB.includes(PREFIX_B) && !textB.includes(PREFIX_A), 'Isolation lots admin B incorrecte.');
  summary.apiChecks.push({ label: 'admin A voit A sans B', status: lotsA.status });
  summary.apiChecks.push({ label: 'admin B voit B sans A', status: lotsB.status });

  const forcedHeader = await requestApi(tokenA, '/api/lots', orgB.id);
  assert(forcedHeader.status === 403, 'Header x-organization-id force non refuse.');
  summary.apiChecks.push({ label: 'x-organization-id force refuse', status: forcedHeader.status });
};

async function main() {
  let orgA = await resolveOrganization('A');
  let orgB = await resolveOrganization('B');
  assert(orgA, 'Organisation A introuvable via utilisateurs admin-a@cave.test ou slug existant.');
  assert(orgB, 'Organisation B introuvable via utilisateurs admin-b@cave.test ou slug existant.');
  assert(orgA.id !== orgB.id, 'Les organisations A et B doivent etre distinctes.');

  orgA = await ensureOrganizationDisplayName('A', orgA);
  orgB = await ensureOrganizationDisplayName('B', orgB);

  summary.organizations.A = redactOrg(orgA);
  summary.organizations.B = redactOrg(orgB);

  await verifyMemberships('A', orgA.id);
  await verifyMemberships('B', orgB.id);

  await createDataA(orgA);
  await createDataB(orgB);
  await verifyDataIsolation(orgA, orgB);
  await optionalApiChecks(orgA, orgB);

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
