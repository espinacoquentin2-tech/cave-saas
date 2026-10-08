const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { fixture, prisma } = require("../helpers/levain-fixture.cjs");
const {
  LevainService,
} = require("../../server/modules/levains/levain.service.ts");
const enabled = process.env.LEVAIN_TEST_DATABASE === "true";
async function product(tx, actor, name = "LSA", unit = "kg", stock = 10) {
  return tx.product.create({
    data: {
      organizationId: actor.organizationId,
      name,
      category: "Intrants",
      subCategory: name,
      unit,
      currentStock: stock,
    },
  });
}
const measures = {
  temperatureC: 16,
  density20: 998,
  alcoholPct: 12,
  residualSugarGPerL: 20,
  ph: 3.1,
  populationMillionsPerMl: 60,
};
function creation(tank, p, extra = {}) {
  return {
    sourceContainerId: tank.id,
    volumeHl: 2,
    capacityHl: 5,
    protocol: {
      reference: "Protocole cave",
      text: "Étapes renseignées par le caviste",
    },
    step: { label: "Introduction LSA", performedAt: "2026-10-01T08:00:00Z" },
    products: p
      ? [{ productId: p.id, quantity: 0.1, unit: "kg", kind: "LSA" }]
      : [],
    idempotencyKey: randomUUID(),
    ...extra,
  };
}
const snapshot = (r) => ({
  lotId: r.levainLotId,
  volumeHl: r.levainVolumeHl,
  status: r.state,
  lastMutationEventId: r.lastMutationEventId,
});
const qualification = (r, extra = {}) => ({
  snapshot: snapshot(r),
  protocolCompleted: true,
  performedAt: "2026-10-04T08:00:00Z",
  measurements: measures,
  idempotencyKey: randomUUID(),
  ...extra,
});
function db(name, work) {
  test(name, { skip: !enabled }, () => fixture(work));
}
db(
  "creation is preparation, qualification requires recorded LSA",
  async ({ tx, actor, tank }) => {
    const r = await LevainService.create(creation(tank), actor);
    assert.equal(r.state, "LEVAIN_EN_PREPARATION");
    await assert.rejects(
      LevainService.qualify(qualification(r), actor),
      (e) => e.statusCode === 409,
    );
    const p = await product(tx, actor);
    const added = await LevainService.prepare(
      {
        snapshot: snapshot(r),
        step: { label: "LSA", performedAt: "2026-10-02T08:00:00Z" },
        products: [{ productId: p.id, quantity: 0.1, unit: "kg", kind: "LSA" }],
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    const ready = await LevainService.qualify(qualification(added), actor);
    assert.equal(ready.state, "LEVAIN_PRET");
    await assert.rejects(
      LevainService.qualify(qualification(r), actor),
      (e) => e.statusCode === 409,
    );
  },
);
db(
  "legacy resume is explicit and does not debit historical LSA",
  async ({ tx, actor, lot }) => {
    await tx.lot.update({
      where: { id: lot.id },
      data: { status: "ACTIF", qualiteLot: "LEVAIN" },
    });
    const r = {
      levainLotId: lot.id,
      levainVolumeHl: 10,
      state: "ACTIF",
      lastMutationEventId: null,
    };
    await assert.rejects(
      LevainService.qualify(qualification(r), actor),
      (e) => e.statusCode === 409,
    );
    const ready = await LevainService.qualify(
      qualification(r, {
        legacyResume: true,
        protocol: {
          reference: "Historique",
          text: "Levain préparé avant la révision",
        },
      }),
      actor,
    );
    assert.equal(ready.state, "LEVAIN_PRET");
    assert.equal(
      await tx.stockMovement.count({
        where: { organizationId: actor.organizationId },
      }),
      0,
    );
  },
);
db(
  "observations persist measurements without changing volume",
  async ({ tx, actor, tank }) => {
    const p = await product(tx, actor),
      r = await LevainService.create(creation(tank, p), actor);
    const result = await LevainService.observe(
      {
        lotId: r.levainLotId,
        performedAt: "2026-10-02T08:00:00Z",
        measurements: measures,
        intervention: "AERATION",
        comment: "Air filtré",
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    assert.ok(result.analysisId);
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: r.levainLotId } }))
          .currentVolume,
      ),
      2,
    );
    assert.equal(
      (await LevainService.qualify(qualification(r), actor)).state,
      "LEVAIN_PRET",
    );
  },
);
db(
  "occupied tank and late audit failure leave preparation unchanged",
  async ({ tx, actor, tank, lot }) => {
    const p = await product(tx, actor);
    await assert.rejects(
      LevainService.create(
        creation(tank, p, { destinationContainerId: tank.id }),
        actor,
      ),
      (e) => e.statusCode === 409,
    );
    const {
      LevainRepository,
    } = require("../../server/modules/levains/levain.repository.ts");
    const original = LevainRepository.withTransaction;
    LevainRepository.withTransaction = (work) =>
      original((real) =>
        work(
          new Proxy(real, {
            get(t, k) {
              return k === "auditLog"
                ? {
                    create: async () => {
                      throw new Error("AUDIT_FAILURE");
                    },
                  }
                : Reflect.get(t, k);
            },
          }),
        ),
      );
    try {
      await assert.rejects(
        LevainService.create(creation(tank, p), actor),
        /AUDIT_FAILURE/,
      );
    } finally {
      LevainRepository.withTransaction = original;
    }
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      10,
    );
    assert.equal(
      Number(
        (await tx.product.findUnique({ where: { id: p.id } })).currentStock,
      ),
      10,
    );
    assert.equal(
      await tx.lotEvent.count({
        where: { organizationId: actor.organizationId },
      }),
      0,
    );
  },
);
db(
  "generic intrants cannot alter a qualified levain",
  async ({ tx, actor, tank }) => {
    const { LotsService } = require("../../services/lots.service.ts");
    const {
      LevainRepository,
    } = require("../../server/modules/levains/levain.repository.ts");
    const p = await product(tx, actor);
    const ready = await LevainService.qualify(
      qualification(await LevainService.create(creation(tank, p), actor)),
      actor,
    );
    const original = prisma.$transaction;
    prisma.$transaction = (operation) =>
      LevainRepository.withTransaction(operation);
    try {
      await assert.rejects(
        LotsService.addIntrant(
          {
            lotId: ready.levainLotId,
            intrant: "Nutriment",
            quantity: 0.1,
            unit: "kg",
            productId: p.id,
            idempotencyKey: randomUUID(),
          },
          actor.email,
          actor.organizationId,
        ),
        (e) => e.statusCode === 409,
      );
    } finally {
      prisma.$transaction = original;
    }
  },
);
test.after(() => prisma.$disconnect());
module.exports = { product, creation, qualification, snapshot, measures };
