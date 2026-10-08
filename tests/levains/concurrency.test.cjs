const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const { prisma } = require("../../server/shared/prisma.ts");
const {
  LevainService,
} = require("../../server/modules/levains/levain.service.ts");
const { parameters } = require("../helpers/levain-recipes.cjs");
test(
  "two real transactions cannot feed the same snapshot twice",
  { skip: process.env.LEVAIN_TEST_DATABASE !== "true" },
  async () => {
    let data;
    const keys = [randomUUID(), randomUUID()];
    try {
      data = await prisma.$transaction(async (tx) => {
        const tag = randomUUID(),
          org = await tx.organization.create({
            data: { name: "Concurrent levain test", slug: tag },
          }),
          user = await tx.user.create({
            data: {
              name: "Concurrent test",
              email: `${tag}@example.test`,
              role: "Admin",
              roleKey: "ADMIN",
            },
          });
        const sourceTank = await tx.container.create({
            data: {
              organizationId: org.id,
              code: `S-${tag}`,
              displayName: "Vin recette",
              type: "CUVE_INOX",
              capacityValue: 100,
              status: "PLEIN",
            },
          }),
          levainTank = await tx.container.create({
            data: {
              organizationId: org.id,
              code: `L-${tag}`,
              displayName: "Levain recette",
              type: "CUVE_INOX",
              capacityValue: 10,
              status: "PLEIN",
            },
          });
        const source = await tx.lot.create({
            data: {
              organizationId: org.id,
              technicalCode: `S-${tag}`,
              businessCode: `S-${tag}`,
              year: 2026,
              mainGrapeCode: "CH",
              sequenceNumber: 1,
              status: "VIN_DE_BASE",
              currentVolume: 50,
              currentContainerId: sourceTank.id,
            },
          }),
          levain = await tx.lot.create({
            data: {
              organizationId: org.id,
              technicalCode: `L-${tag}`,
              businessCode: `L-${tag}`,
              year: 2026,
              mainGrapeCode: "CH",
              sequenceNumber: 1,
              status: "LEVAIN_PRET",
              qualiteLot: "LEVAIN",
              currentVolume: 2,
              currentContainerId: levainTank.id,
            },
          });
        const q = await tx.product.create({
            data: {
              organizationId: org.id,
              name: "Liqueur test",
              category: "Intrants",
              subCategory: "Liqueur",
              unit: "hL",
              currentStock: 10,
            },
          }),
          dap = await tx.product.create({
            data: {
              organizationId: org.id,
              name: "DAP test",
              category: "Intrants",
              subCategory: "DAP",
              unit: "kg",
              currentStock: 10,
            },
          });
        return { org, user, sourceTank, levainTank, source, levain, q, dap };
      });
      const actor = {
        userId: data.user.id,
        email: data.user.email,
        role: "ADMIN",
        roleKey: "ADMIN",
        organizationId: data.org.id,
        organizationSlug: data.org.slug,
        organizationName: data.org.name,
      };
      const input = {
        ...parameters,
        sourceContainerId: data.sourceTank.id,
        levainContainerId: data.levainTank.id,
        snapshot: {
          lotId: data.levain.id,
          volumeHl: 2,
          status: "LEVAIN_PRET",
          lastMutationEventId: null,
        },
        liqueur: {
          mode: "PREPARED",
          productId: data.q.id,
          sugarGfPerL: 530,
          alcoholPct: 7.5,
        },
        dapProductId: data.dap.id,
      };
      const results = await Promise.allSettled(
        keys.map((idempotencyKey) =>
          LevainService.feed({ ...input, idempotencyKey }, actor),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.find((r) => r.status === "rejected").reason.statusCode,
        409,
      );
      assert.equal(
        Number(
          (await prisma.lot.findUnique({ where: { id: data.levain.id } }))
            .currentVolume,
        ),
        4,
      );
      assert.equal(
        Number(
          (await prisma.product.findUnique({ where: { id: data.dap.id } }))
            .currentStock,
        ),
        9.92,
      );
      assert.equal(
        await prisma.lotEvent.count({
          where: {
            organizationId: data.org.id,
            eventType: "ALIMENTATION_LEVAIN",
          },
        }),
        1,
      );
    } finally {
      if (data) {
        const organizationId = data.org.id;
        await prisma.$transaction(
          async (tx) => {
            const events = await tx.lotEvent.findMany({
                where: { organizationId },
                select: { id: true },
              }),
              ids = events.map((e) => e.id);
            await tx.lotEventIntrant.deleteMany({
              where: { eventId: { in: ids } },
            });
            await tx.lotEventContainer.deleteMany({
              where: { eventId: { in: ids } },
            });
            await tx.lotEventLot.deleteMany({
              where: { eventId: { in: ids } },
            });
            await tx.lotEvent.deleteMany({ where: { organizationId } });
            await tx.analysis.deleteMany({ where: { organizationId } });
            await tx.stockMovement.deleteMany({ where: { organizationId } });
            await tx.intrant.deleteMany({
              where: {
                code: {
                  in: [
                    `INTRANT-PRODUCT-${data.q.id}`,
                    `INTRANT-PRODUCT-${data.dap.id}`,
                  ],
                },
              },
            });
            await tx.product.deleteMany({ where: { organizationId } });
            await tx.lot.deleteMany({ where: { organizationId } });
            await tx.container.deleteMany({ where: { organizationId } });
            await tx.auditLog.deleteMany({ where: { organizationId } });
            await tx.idempotencyRecord.deleteMany({
              where: { key: { in: keys } },
            });
            await tx.user.delete({ where: { id: data.user.id } });
            await tx.organization.delete({ where: { id: organizationId } });
          },
          { timeout: 20000 },
        );
        assert.equal(
          await prisma.organization.count({ where: { id: organizationId } }),
          0,
        );
      }
    }
  },
);
test.after(() => prisma.$disconnect());
