const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const { prisma } = require('../../server/shared/prisma.ts');
const { LevainService } = require('../../server/modules/levains/levain.service.ts');
const { LevainRepository } = require('../../server/modules/levains/levain.repository.ts');
const enabled = process.env.LEVAIN_TEST_DATABASE === 'true';
const feedInput = { remainingVolumeHl: 2, finalVolumeHl: 4, previousDensity: 1000, currentDensity: 1000, liqueurSugarGPerL: 600, wineAlcoholPct: 13 };

// Données éphémères dans une transaction externe toujours annulée. Les savepoints
// conservent la sémantique tout-ou-rien de chaque opération testée à l'intérieur.
async function fixture(work) {
  const rollback = new Error('ROLLBACK_FIXTURE');
  const original = LevainRepository.withTransaction;
  let organizationId;
  try {
    await prisma.$transaction(async tx => {
      const suffix = randomUUID();
      const organization = await tx.organization.create({ data: { name: 'Recette levains', slug: `test-levain-${suffix}` } });
      organizationId = organization.id;
      const user = await tx.user.create({ data: { name: 'Recette levains', email: `levain-${suffix}@example.test`, role: 'Admin', roleKey: 'ADMIN' } });
      const tank = await tx.container.create({ data: { organizationId, code: `TEST-${suffix}`, displayName: 'Vin source', type: 'CUVE_INOX', capacityValue: 20, status: 'PLEIN' } });
      const lot = await tx.lot.create({ data: { organizationId, technicalCode: `TEST-${suffix}`, businessCode: `TEST-${suffix}`, year: 2026, mainGrapeCode: 'CH', sequenceNumber: 1, status: 'VIN_DE_BASE', currentVolume: 10, currentContainerId: tank.id } });
      const actor = { userId: user.id, email: user.email, role: 'ADMIN', roleKey: 'ADMIN', organizationId, organizationSlug: organization.slug, organizationName: organization.name };
      LevainRepository.withTransaction = async operation => {
        await tx.$executeRawUnsafe('SAVEPOINT levain_operation');
        try {
          const result = await operation(tx);
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT levain_operation');
          return result;
        } catch (error) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT levain_operation');
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT levain_operation');
          throw error;
        }
      };
      await work({ tx, actor, tank, lot });
      throw rollback;
    }, { isolationLevel: 'Serializable', timeout: 60_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    LevainRepository.withTransaction = original;
  }
  assert.equal(await prisma.organization.count({ where: { id: organizationId } }), 0, 'Aucune donnée de recette ne doit rester en base.');
}
const create = (tank, extra = {}) => ({ sourceContainerId: tank.id, volumeHl: 2, capacityHl: 5, idempotencyKey: randomUUID(), ...extra });
const feed = (tank, levain, extra = {}) => ({ ...feedInput, sourceContainerId: tank.id, levainContainerId: levain.levainContainerId, idempotencyKey: randomUUID(), ...extra });
const conflict = error => error.statusCode === 409;

function dbTest(name, work) { test(name, { skip: !enabled }, () => fixture(work)); }

dbTest('la création enregistre le levain et débite le vrai lot source', async ({ tx, actor, tank, lot }) => {
  const result = await LevainService.create(create(tank), actor);
  const source = await tx.lot.findUnique({ where: { id: lot.id } });
  const levain = await tx.lot.findUnique({ where: { id: result.levainLotId } });
  assert.equal(Number(source.currentVolume), 8);
  assert.equal(Number(levain.currentVolume), 2);
  assert.equal(levain.qualiteLot, 'LEVAIN');
  assert.equal(levain.organizationId, actor.organizationId);
  const links = await tx.lotEventLot.findMany({ where: { eventId: result.eventId } });
  assert.deepEqual(links.map(link => Number(link.volumeChange)).sort((a,b) => a-b), [-2, 2]);
});

dbTest('le nourrissage persiste les volumes et trace les apports sans modifier les stocks inventaire', async ({ tx, actor, tank, lot }) => {
  const levain = await LevainService.create(create(tank), actor);
  const result = await LevainService.feed(feed(tank, levain), actor);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 6.189);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: levain.levainLotId } })).currentVolume), 4);
  const event = await tx.lotEvent.findUnique({ where: { id: result.eventId } });
  assert.equal(event.metadata.calculation.liqueurVolumeHl, 0.067);
  assert.equal(event.metadata.calculation.waterVolumeHl, 0.122);
  assert.equal(await tx.auditLog.count({ where: { organizationId: actor.organizationId } }), 2);
  assert.equal(await tx.stockMovement.count({ where: { organizationId: actor.organizationId } }), 0);
});

dbTest('une double création ne débite le vin qu’une fois', async ({ tx, actor, tank, lot }) => {
  const input = create(tank);
  await LevainService.create(input, actor);
  await assert.rejects(LevainService.create(input, actor), conflict);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 8);
  assert.equal(await tx.container.count({ where: { organizationId: actor.organizationId } }), 2);
});

dbTest('un second nourrissage avec un ancien volume est refusé', async ({ tx, actor, tank, lot }) => {
  const levain = await LevainService.create(create(tank), actor);
  const input = feed(tank, levain);
  await LevainService.feed(input, actor);
  await assert.rejects(LevainService.feed(input, actor), conflict);
  await assert.rejects(LevainService.feed({ ...input, idempotencyKey: randomUUID() }, actor), conflict);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 6.189);
});

dbTest('un manque de vin ne laisse ni cuve ni requête partielle', async ({ tx, actor, tank, lot }) => {
  await assert.rejects(LevainService.create(create(tank, { volumeHl: 11, capacityHl: 15 }), actor), conflict);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 10);
  assert.equal(await tx.container.count({ where: { organizationId: actor.organizationId } }), 1);
  assert.equal(await tx.idempotencyRecord.count({ where: { userId: `${actor.organizationId}:${actor.userId}` } }), 0);
});

dbTest('la capacité du levain est contrôlée avant de débiter le vin', async ({ tx, actor, tank, lot }) => {
  const levain = await LevainService.create(create(tank, { capacityHl: 3 }), actor);
  await assert.rejects(LevainService.feed(feed(tank, levain), actor), conflict);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 8);
});

dbTest('la source d’une autre organisation reste inaccessible', async ({ tx, actor, tank, lot }) => {
  const other = await tx.organization.create({ data: { name: 'Autre organisation', slug: `other-${randomUUID()}` } });
  await assert.rejects(LevainService.create(create(tank), { ...actor, organizationId: other.id }), error => error.statusCode === 404);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 10);
});

dbTest('une erreur de traçabilité annule les écritures de création', async ({ tx, actor, tank, lot }) => {
  const transaction = LevainRepository.withTransaction;
  LevainRepository.withTransaction = operation => transaction(realTx => operation(new Proxy(realTx, { get(target, key) { return key === 'auditLog' ? { create: async () => { throw new Error('AUDIT_FAILURE'); } } : Reflect.get(target, key); } })));
  await assert.rejects(LevainService.create(create(tank), actor), /AUDIT_FAILURE/);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 10);
  assert.equal(await tx.lotEvent.count({ where: { organizationId: actor.organizationId } }), 0);
  assert.equal(await tx.container.count({ where: { organizationId: actor.organizationId } }), 1);
});

dbTest('consommer tout le vin libère la cuve sans volume négatif', async ({ tx, actor, tank, lot }) => {
  await LevainService.create(create(tank, { volumeHl: 10, capacityHl: 12 }), actor);
  const source = await tx.lot.findUnique({ where: { id: lot.id } });
  assert.equal(Number(source.currentVolume), 0);
  assert.equal(source.currentContainerId, null);
  assert.equal((await tx.container.findUnique({ where: { id: tank.id } })).status, 'EN_NETTOYAGE');
});


dbTest('la généalogie relie le levain au vin source dans les deux sens', async ({ tx, actor, tank, lot }) => {
  const { TracabiliteService } = require('../../services/tracabilite.service.ts');
  const result = await LevainService.create(create(tank), actor);
  const levain = await tx.lot.findUnique({ where: { id: result.levainLotId } });
  const suffix = randomUUID();
  const nourishingTank = await tx.container.create({ data: { organizationId: actor.organizationId, code: `SECOND-${suffix}`, displayName: 'Second vin source', type: 'CUVE_INOX', capacityValue: 20, status: 'PLEIN' } });
  const nourishingLot = await tx.lot.create({ data: { organizationId: actor.organizationId, technicalCode: `SECOND-${suffix}`, businessCode: `SECOND-${suffix}`, year: 2026, mainGrapeCode: 'CH', sequenceNumber: 1, status: 'VIN_DE_BASE', currentVolume: 10, currentContainerId: nourishingTank.id } });
  await LevainService.feed(feed(nourishingTank, result), actor);
  const lineage = await TracabiliteService.getLineage({ lotCode: levain.businessCode, type: 'bulk' }, actor.organizationId, tx);
  assert.deepEqual(lineage.parents.map(parent => parent.id).sort((a,b) => a-b), [lot.id, nourishingLot.id].sort((a,b) => a-b));
  const sourceLineage = await TracabiliteService.getLineage({ lotCode: lot.businessCode, type: 'bulk' }, actor.organizationId, tx);
  assert.deepEqual(sourceLineage.children.map(child => child.id), [levain.id]);
});

dbTest('une erreur de traçabilité annule aussi le nourrissage', async ({ tx, actor, tank, lot }) => {
  const levain = await LevainService.create(create(tank), actor);
  const transaction = LevainRepository.withTransaction;
  LevainRepository.withTransaction = operation => transaction(realTx => operation(new Proxy(realTx, { get(target, key) { return key === 'auditLog' ? { create: async () => { throw new Error('AUDIT_FAILURE'); } } : Reflect.get(target, key); } })));
  await assert.rejects(LevainService.feed(feed(tank, levain), actor), /AUDIT_FAILURE/);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 8);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: levain.levainLotId } })).currentVolume), 2);
  assert.equal(await tx.lotEvent.count({ where: { organizationId: actor.organizationId } }), 1);
});


dbTest('un petit écart d’arrondi ne permet pas de prélever plus de vin que disponible', async ({ tx, actor, tank, lot }) => {
  await tx.lot.update({ where: { id: lot.id }, data: { currentVolume: 9.9996 } });
  await assert.rejects(LevainService.create(create(tank, { volumeHl: 10, capacityHl: 12 }), actor), conflict);
  assert.equal(Number((await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume), 9.9996);
});

test.after(() => prisma.$disconnect());
