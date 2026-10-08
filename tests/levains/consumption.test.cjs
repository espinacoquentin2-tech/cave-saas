const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { fixture, prisma } = require("../helpers/levain-fixture.cjs");
const { consumeRecipe } = fs.existsSync(
  "server/modules/levains/levain-consumption.ts",
)
  ? require("../../server/modules/levains/levain-consumption.ts")
  : {};
const enabled = process.env.LEVAIN_TEST_DATABASE === "true";
function db(name, work) {
  test(name, { skip: !enabled }, () => fixture(work));
}
async function event(tx, actor) {
  return tx.lotEvent.create({
    data: {
      organizationId: actor.organizationId,
      operatorUserId: actor.userId,
      eventType: "TEST_CONSUME",
    },
  });
}
db(
  "same lot is debited once for the summed wine",
  async ({ tx, actor, lot }) => {
    assert.equal(typeof consumeRecipe, "function");
    const e = await event(tx, actor);
    const r = await consumeRecipe(tx, actor, e.id, {
      lots: [
        { lotId: lot.id, volumeHl: 1 },
        { lotId: lot.id, volumeHl: 0.685 },
      ],
      products: [],
    });
    assert.equal(r.lotDebits.length, 1);
    assert.equal(r.lotDebits[0].remainingVolumeHl, 8.315);
  },
);
db(
  "mass units are converted to actual product stock unit",
  async ({ tx, actor }) => {
    assert.equal(typeof consumeRecipe, "function");
    const p = await tx.product.create({
      data: {
        organizationId: actor.organizationId,
        name: "DAP",
        category: "Intrants",
        subCategory: "DAP",
        unit: "kg",
        currentStock: 1,
      },
    });
    const e = await event(tx, actor);
    const r = await consumeRecipe(tx, actor, e.id, {
      lots: [],
      products: [{ productId: p.id, quantity: 80, unit: "g", kind: "DAP" }],
    });
    assert.equal(r.productDebits[0].quantity, 0.08);
    assert.equal(
      Number(
        (await tx.product.findUnique({ where: { id: p.id } })).currentStock,
      ),
      0.92,
    );
    assert.equal(
      await tx.lotEventIntrant.count({ where: { eventId: e.id } }),
      1,
    );
  },
);
db(
  "combined debit cannot overdraw even when each individual request fits",
  async ({ tx, actor, lot }) => {
    assert.equal(typeof consumeRecipe, "function");
    const e = await event(tx, actor);
    await assert.rejects(
      consumeRecipe(tx, actor, e.id, {
        lots: [
          { lotId: lot.id, volumeHl: 6 },
          { lotId: lot.id, volumeHl: 6 },
        ],
        products: [],
      }),
      (e) => e.statusCode === 409,
    );
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      10,
    );
  },
);
db(
  "foreign product and stock rounded up are rejected",
  async ({ tx, actor }) => {
    assert.equal(typeof consumeRecipe, "function");
    const p = await tx.product.create({
      data: {
        organizationId: actor.organizationId,
        name: "Sucre",
        category: "Intrants",
        subCategory: "Sucres",
        unit: "kg",
        currentStock: 0.0796,
      },
    });
    const e = await event(tx, actor);
    await assert.rejects(
      consumeRecipe(tx, actor, e.id, {
        lots: [],
        products: [
          { productId: p.id, quantity: 0.08, unit: "kg", kind: "DAP" },
        ],
      }),
      (e) => e.statusCode === 409,
    );
    await assert.rejects(
      consumeRecipe(tx, { ...actor, organizationId: -1 }, e.id, {
        lots: [],
        products: [
          { productId: p.id, quantity: 0.01, unit: "kg", kind: "DAP" },
        ],
      }),
      (e) => e.statusCode === 404,
    );
  },
);
test.after(() => prisma.$disconnect());
