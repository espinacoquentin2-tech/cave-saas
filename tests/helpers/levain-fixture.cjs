const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const { prisma } = require("../../server/shared/prisma.ts");
const {
  LevainRepository,
} = require("../../server/modules/levains/levain.repository.ts");
async function fixture(work, repositories = [LevainRepository]) {
  const rollback = new Error("ROLLBACK_FIXTURE");
  const originals = repositories.map(
    (repository) => repository.withTransaction,
  );
  let organizationId;
  try {
    await prisma.$transaction(
      async (tx) => {
        const suffix = randomUUID();
        const organization = await tx.organization.create({
          data: { name: "Recette levains", slug: `test-levain-${suffix}` },
        });
        organizationId = organization.id;
        const user = await tx.user.create({
          data: {
            name: "Recette levains",
            email: `levain-${suffix}@example.test`,
            role: "Admin",
            roleKey: "ADMIN",
          },
        });
        const tank = await tx.container.create({
          data: {
            organizationId,
            code: `TEST-${suffix}`,
            displayName: "Vin source",
            type: "CUVE_INOX",
            capacityValue: 20,
            status: "PLEIN",
          },
        });
        const lot = await tx.lot.create({
          data: {
            organizationId,
            technicalCode: `TEST-${suffix}`,
            businessCode: `TEST-${suffix}`,
            year: 2026,
            mainGrapeCode: "CH",
            sequenceNumber: 1,
            status: "VIN_DE_BASE",
            currentVolume: 10,
            currentContainerId: tank.id,
          },
        });
        const actor = {
          userId: user.id,
          email: user.email,
          role: "ADMIN",
          roleKey: "ADMIN",
          organizationId,
          organizationSlug: organization.slug,
          organizationName: organization.name,
        };
        for (const repository of repositories)
          repository.withTransaction = async (operation) => {
            await tx.$executeRawUnsafe("SAVEPOINT levain_operation");
            try {
              const result = await operation(tx);
              await tx.$executeRawUnsafe("RELEASE SAVEPOINT levain_operation");
              return result;
            } catch (error) {
              await tx.$executeRawUnsafe(
                "ROLLBACK TO SAVEPOINT levain_operation",
              );
              await tx.$executeRawUnsafe("RELEASE SAVEPOINT levain_operation");
              throw error;
            }
          };
        await work({ tx, actor, tank, lot });
        throw rollback;
      },
      { isolationLevel: "Serializable", timeout: 60_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    repositories.forEach((repository, i) => {
      repository.withTransaction = originals[i];
    });
  }
  assert.equal(
    await prisma.organization.count({ where: { id: organizationId } }),
    0,
    "Aucune donnée de recette ne doit rester en base.",
  );
}

module.exports = { fixture, prisma };
