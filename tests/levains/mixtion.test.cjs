const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { fixture, prisma } = require("../helpers/levain-fixture.cjs");
const {
  product,
  creation,
  qualification,
  snapshot,
} = require("../helpers/levain-recipes.cjs");
const {
  LevainService,
} = require("../../server/modules/levains/levain.service.ts");
const {
  TirageModuleService,
} = require("../../server/modules/tirage/tirage.service.ts");
const {
  TirageRepository,
} = require("../../server/modules/tirage/tirage.repository.ts");
const {
  LevainRepository,
} = require("../../server/modules/levains/levain.repository.ts");
const { MixtionService } = fs.existsSync(
  "server/modules/tirage/mixtion.service.ts",
)
  ? require("../../server/modules/tirage/mixtion.service.ts")
  : {};
function db(name, work) {
  test(name, { skip: process.env.LEVAIN_TEST_DATABASE !== "true" }, () =>
    fixture(work, [LevainRepository, TirageRepository]),
  );
}
async function setup(tx, actor, tank, lot) {
  const lsa = await product(tx, actor),
    sugar = await product(tx, actor, "Sucre", "kg", 100);
  const ready = await LevainService.qualify(
    qualification(await LevainService.create(creation(tank, lsa), actor)),
    actor,
  );
  const dest = await tx.container.create({
    data: {
      organizationId: actor.organizationId,
      code: randomUUID(),
      displayName: "Mixtion",
      type: "CUVE_INOX",
      capacityValue: 10,
      status: "VIDE",
    },
  });
  return {
    ready,
    sugar,
    dest,
    input: {
      sourceLotId: lot.id,
      baseVolumeHl: 2,
      snapshot: snapshot(ready),
      levainVolumeHl: 0.2,
      destinationContainerId: dest.id,
      baseSugarGPerL: 1,
      levainSugarGPerL: 20,
      targetSugarGPerL: 25.4,
      sugarSource: "SUCRE",
      sugarProductId: sugar.id,
      adjuvants: [],
      idempotencyKey: randomUUID(),
    },
  };
}
async function packaging(tx, actor, count) {
  const result = [];
  for (const [kind, sub] of [
    ["PACKAGING_BOTTLE", "Bouteilles"],
    ["PACKAGING_PRIMARY_CLOSURE", "Capsules"],
    ["PACKAGING_SECONDARY_CLOSURE", "Bidules"],
  ]) {
    const p = await tx.product.create({
      data: {
        organizationId: actor.organizationId,
        name: sub,
        category: "Matieres seches",
        subCategory: sub,
        unit: "unites",
        currentStock: 1000,
      },
    });
    result.push({
      productId: p.id,
      kind,
      quantity: count,
      unit: "unites",
      label: sub,
    });
  }
  return result;
}
db(
  "mixtion consumes ready levain, bottling keeps exact remainder without second intrant debit",
  async ({ tx, actor, tank, lot }) => {
    assert.equal(typeof MixtionService, "function");
    const { ready, input } = await setup(tx, actor, tank, lot);
    const mix = await MixtionService.create(input, actor);
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: ready.levainLotId } }))
          .currentVolume,
      ),
      1.8,
    );
    const count = Math.floor(mix.volumeHl / 0.0075),
      stockItems = await packaging(tx, actor, count),
      body = {
        lotId: mix.mixtionLotId,
        sourceContainerId: mix.mixtionContainerId,
        format: "75cl",
        count,
        volume: mix.volumeHl,
        bouchage: "CAPSULE",
        tirageDate: new Date().toISOString(),
        isTranquille: false,
        stockItems,
        calculatedItems: [],
        idempotencyKey: randomUUID(),
      };
    await assert.rejects(
      TirageModuleService.execute(body, actor),
      (e) => e.statusCode === 409,
    );
    await MixtionService.check(
      {
        lotId: mix.mixtionLotId,
        expectedVolumeHl: mix.volumeHl,
        lastMutationEventId: mix.eventId,
        performedAt: new Date().toISOString(),
        wineDensity20: 991.6,
        mixtionDensity20: 1001.4,
        operatorConfirmed: true,
        comment: "Point contrôlé",
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    const changed = await tx.lotEvent.create({
      data: {
        organizationId: actor.organizationId,
        eventType: "INTRANT",
        operatorUserId: actor.userId,
        lots: {
          create: {
            lotId: mix.mixtionLotId,
            roleInEvent: "CIBLE",
            volumeChange: 0,
          },
        },
      },
    });
    await assert.rejects(
      TirageModuleService.execute(body, actor),
      (e) => e.statusCode === 409,
    );
    await MixtionService.check(
      {
        lotId: mix.mixtionLotId,
        expectedVolumeHl: mix.volumeHl,
        lastMutationEventId: changed.id,
        performedAt: new Date().toISOString(),
        wineDensity20: 991.6,
        mixtionDensity20: 1001.4,
        operatorConfirmed: true,
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    const before = await tx.stockMovement.count({
      where: { organizationId: actor.organizationId },
    });
    const result = await TirageModuleService.execute(body, actor);
    assert.equal(
      await tx.stockMovement.count({
        where: { organizationId: actor.organizationId },
      }),
      before + 3,
    );
    const remaining = Number(
      (await tx.lot.findUnique({ where: { id: mix.mixtionLotId } }))
        .currentVolume,
    );
    assert.ok(Math.abs(remaining - (mix.volumeHl - count * 0.0075)) < 1e-10);
    assert.equal(result.bottleCount, count);
    assert.equal(result.consumedVolume, Number((count * 0.0075).toFixed(5)));
    await MixtionService.check(
      {
        lotId: mix.mixtionLotId,
        expectedVolumeHl: remaining,
        lastMutationEventId: changed.id,
        performedAt: new Date().toISOString(),
        wineDensity20: 991.6,
        mixtionDensity20: 1001.4,
        operatorConfirmed: true,
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    const {
      TracabiliteService,
    } = require("../../services/tracabilite.service.ts");
    const genealogy = await TracabiliteService.getLineage(
      {
        lotCode: (await tx.lot.findUnique({ where: { id: mix.mixtionLotId } }))
          .businessCode,
        type: "bulk",
      },
      actor.organizationId,
      tx,
    );
    assert.ok(genealogy.parents.some((p) => p.id === ready.levainLotId));
    assert.ok(genealogy.parents.some((p) => p.id === lot.id));
    const bottled = await TracabiliteService.getLineage(
      { lotCode: result.bottleLotCode, type: "bottle" },
      actor.organizationId,
      tx,
    );
    assert.ok(bottled.parents.some((p) => p.id === mix.mixtionLotId));
  },
);
db(
  "unqualified levain and duplicate mixtion cannot produce extra debits",
  async ({ tx, actor, tank, lot }) => {
    assert.equal(typeof MixtionService, "function");
    const { ready, input } = await setup(tx, actor, tank, lot);
    await tx.lot.update({
      where: { id: ready.levainLotId },
      data: { status: "LEVAIN_EN_PROPAGATION" },
    });
    await assert.rejects(
      MixtionService.create(input, actor),
      (e) => e.statusCode === 409,
    );
    await tx.lot.update({
      where: { id: ready.levainLotId },
      data: { status: "LEVAIN_PRET" },
    });
    await MixtionService.create(input, actor);
    await assert.rejects(
      MixtionService.create(input, actor),
      (e) => e.statusCode === 409,
    );
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: ready.levainLotId } }))
          .currentVolume,
      ),
      1.8,
    );
  },
);
db(
  "quiet wine retains direct bottling without levain or mixtion",
  async ({ tx, actor, tank, lot }) => {
    const stockItems = await packaging(tx, actor, 133);
    const result = await TirageModuleService.execute(
      {
        lotId: lot.id,
        sourceContainerId: tank.id,
        format: "75cl",
        count: 133,
        volume: 1,
        bouchage: "CAPSULE",
        tirageDate: new Date().toISOString(),
        isTranquille: true,
        stockItems,
        calculatedItems: [],
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    assert.equal(result.bottleCount, 133);
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      9.0025,
    );
    assert.equal(
      (await tx.bottleLot.findUnique({ where: { id: result.bottleLotId } }))
        .status,
      "EN_CAVE",
    );
  },
);
test("bottle consumption preserves 37.5cl precision", () => {
  const { calculateConsumedVolumeHl } = require("../../lib/tirage.ts");
  assert.equal(calculateConsumedVolumeHl(1, "37.5cl"), 0.00375);
  const { calculateTiragePlan } = require("../../lib/tirage.ts");
  assert.equal(
    calculateTiragePlan({ requestedVolumeHl: 0.00376, formatCode: "37.5cl" })
      .remainderVolumeHl,
    0.00001,
  );
});
test.after(() => prisma.$disconnect());
