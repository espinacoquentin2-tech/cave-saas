const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { fixture, prisma } = require("../helpers/levain-fixture.cjs");
const { creation } = require("../helpers/levain-recipes.cjs");
const {
  LevainService,
} = require("../../server/modules/levains/levain.service.ts");
function db(name, work) {
  test(name, { skip: process.env.LEVAIN_TEST_DATABASE !== "true" }, () =>
    fixture(work),
  );
}
db(
  "creation preserves scoped volume and genealogy links",
  async ({ tx, actor, tank, lot }) => {
    const r = await LevainService.create(creation(tank), actor);
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      8,
    );
    assert.equal(r.levainVolumeHl, 2);
    const links = await tx.lotEventLot.findMany({
      where: { eventId: r.eventId },
    });
    assert.deepEqual(
      links.map((l) => Number(l.volumeChange)).sort((a, b) => a - b),
      [-2, 2],
    );
  },
);
db(
  "duplicate creation has no second source debit or tank",
  async ({ tx, actor, tank, lot }) => {
    const input = creation(tank);
    await LevainService.create(input, actor);
    await assert.rejects(
      LevainService.create(input, actor),
      (e) => e.statusCode === 409,
    );
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      8,
    );
    assert.equal(
      await tx.container.count({
        where: { organizationId: actor.organizationId },
      }),
      2,
    );
  },
);
db(
  "insufficient wine and capacity leave no orphan tank or idempotency key",
  async ({ tx, actor, tank }) => {
    for (const extra of [
      { volumeHl: 11, capacityHl: 15 },
      { volumeHl: 3, capacityHl: 2 },
    ])
      await assert.rejects(
        LevainService.create(creation(tank, null, extra), actor),
        (e) => e.statusCode === 409,
      );
    assert.equal(
      await tx.container.count({
        where: { organizationId: actor.organizationId },
      }),
      1,
    );
    assert.equal(
      await tx.idempotencyRecord.count({
        where: { userId: `${actor.organizationId}:${actor.userId}` },
      }),
      0,
    );
  },
);
db("foreign source is not accessible", async ({ tx, actor, tank }) => {
  const org = await tx.organization.create({
    data: { name: "Other", slug: randomUUID() },
  });
  await assert.rejects(
    LevainService.create(creation(tank), { ...actor, organizationId: org.id }),
    (e) => e.statusCode === 404,
  );
});
db(
  "exhausted source is archived and its tank is released",
  async ({ tx, actor, tank, lot }) => {
    await LevainService.create(
      creation(tank, null, { volumeHl: 10, capacityHl: 15 }),
      actor,
    );
    const source = await tx.lot.findUnique({ where: { id: lot.id } });
    assert.equal(source.status, "ARCHIVE");
    assert.equal(source.currentContainerId, null);
    assert.equal(
      (await tx.container.findUnique({ where: { id: tank.id } })).status,
      "EN_NETTOYAGE",
    );
  },
);
db(
  "source precision is never rounded up before availability check",
  async ({ tx, actor, tank, lot }) => {
    await tx.lot.update({
      where: { id: lot.id },
      data: { currentVolume: 9.9996 },
    });
    await assert.rejects(
      LevainService.create(
        creation(tank, null, { volumeHl: 10, capacityHl: 15 }),
        actor,
      ),
      (e) => e.statusCode === 409,
    );
    assert.equal(
      Number(
        (await tx.lot.findUnique({ where: { id: lot.id } })).currentVolume,
      ),
      9.9996,
    );
  },
);
test.after(() => prisma.$disconnect());
