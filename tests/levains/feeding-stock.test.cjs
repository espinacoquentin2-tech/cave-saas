const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { fixture, prisma } = require("../helpers/levain-fixture.cjs");
const {
  product,
  creation,
  snapshot,
  qualification,
  parameters,
} = require("../helpers/levain-recipes.cjs");
const {
  LevainService,
} = require("../../server/modules/levains/levain.service.ts");
const enabled = process.env.LEVAIN_TEST_DATABASE === "true";
function db(name, work) {
  test(name, { skip: !enabled }, () => fixture(work));
}
async function ready(tx, actor, tank) {
  const lsa = await product(tx, actor);
  return LevainService.qualify(
    qualification(await LevainService.create(creation(tank, lsa), actor)),
    actor,
  );
}
function feed(tank, r, q, dap, extra = {}) {
  return {
    ...parameters,
    sourceContainerId: tank.id,
    levainContainerId: r.levainContainerId,
    snapshot: snapshot(r),
    liqueur: q,
    dapProductId: dap.id,
    idempotencyKey: randomUUID(),
    ...extra,
  };
}
db(
  "prepared liqueur and DAP are debited once and feeding invalidates readiness",
  async ({ tx, actor, tank }) => {
    const r = await ready(tx, actor, tank),
      q = await product(tx, actor, "Liqueur", "L", 100),
      dap = await product(tx, actor, "DAP");
    const input = feed(
      tank,
      r,
      { mode: "PREPARED", productId: q.id, sugarGfPerL: 530, alcoholPct: 7.5 },
      dap,
    );
    const out = await LevainService.feed(input, actor);
    assert.equal(out.state, "LEVAIN_EN_PROPAGATION");
    assert.equal(out.levainVolumeHl, 4);
    assert.equal(
      Number(
        (await tx.product.findUnique({ where: { id: dap.id } })).currentStock,
      ),
      9.92,
    );
    assert.equal(
      Number(
        (await tx.product.findUnique({ where: { id: q.id } })).currentStock,
      ),
      100 - out.calculation.liqueurVolumeHl * 100,
    );
    await assert.rejects(
      LevainService.feed(input, actor),
      (e) => e.statusCode === 409,
    );
  },
);
db(
  "made liqueur consumes saccharose and dissolution wine from summed source",
  async ({ tx, actor, tank, lot }) => {
    const r = await ready(tx, actor, tank),
      s = await product(tx, actor, "Sucre", "kg", 100),
      dap = await product(tx, actor, "DAP");
    const out = await LevainService.feed(
      feed(
        tank,
        r,
        {
          mode: "MAKE",
          sugarProductId: s.id,
          dissolutionLotId: lot.id,
          sugarGfPerL: 530,
          dissolutionWineAlcoholPct: 11,
        },
        dap,
      ),
      actor,
    );
    assert.equal(out.lotDebits.length, 1);
    assert.ok(
      Number(
        (await tx.product.findUnique({ where: { id: s.id } })).currentStock,
      ) < 100,
    );
    assert.ok(out.lotDebits[0].volumeHl > out.calculation.wineVolumeHl);
  },
);
db(
  "DAP insufficiency and late audit failure rollback every debit",
  async ({ tx, actor, tank, lot }) => {
    const r = await ready(tx, actor, tank),
      q = await product(tx, actor, "Liqueur", "hL", 10),
      dap = await product(tx, actor, "DAP", "kg", 0.01),
      input = feed(
        tank,
        r,
        {
          mode: "PREPARED",
          productId: q.id,
          sugarGfPerL: 530,
          alcoholPct: 7.5,
        },
        dap,
      );
    await assert.rejects(
      LevainService.feed(input, actor),
      (e) => e.statusCode === 409,
    );
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      8,
    );
    assert.equal(
      Number(
        (await tx.product.findUnique({ where: { id: q.id } })).currentStock,
      ),
      10,
    );
    await tx.product.update({
      where: { id: dap.id },
      data: { currentStock: 1 },
    });
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
      await assert.rejects(LevainService.feed(input, actor), /AUDIT_FAILURE/);
    } finally {
      LevainRepository.withTransaction = original;
    }
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      8,
    );
    assert.equal(
      Number(
        (await tx.product.findUnique({ where: { id: q.id } })).currentStock,
      ),
      10,
    );
  },
);
test.after(() => prisma.$disconnect());
