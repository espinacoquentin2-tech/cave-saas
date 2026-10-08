const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const levain = require("../../lib/levain.ts");
const liqueur = fs.existsSync("lib/liqueur.ts")
  ? require("../../lib/liqueur.ts")
  : {};
const planning = fs.existsSync("lib/levain-planning.ts")
  ? require("../../lib/levain-planning.ts")
  : {};
const mixtion = fs.existsSync("lib/mixtion.ts")
  ? require("../../lib/mixtion.ts")
  : {};
const parameters = {
  remainingVolumeHl: 2,
  finalVolumeHl: 4,
  previousDensity: 1000,
  currentDensity: 1000,
  liqueurSugarGPerL: 530,
  wineAlcoholPct: 13,
  remainingSugarGPerL: 20,
  levainAlcoholPct: 12,
  targetAlcoholPct: 12,
  liqueurAlcoholPct: 7.5,
  previousMeasuredAt: "2026-10-01T08:00:00Z",
  currentMeasuredAt: "2026-10-02T08:00:00Z",
  nextWithdrawalAt: "2026-10-03T08:00:00Z",
};
test("an observation needs a real measure, intervention or comment", () => {
  const {
    observationSchema,
  } = require("../../server/modules/levains/levain.schemas.ts");
  const value = {
    lotId: 1,
    performedAt: "2026-10-08T08:00:00Z",
    measurements: {},
    idempotencyKey: require("node:crypto").randomUUID(),
  };
  assert.equal(observationSchema.safeParse(value).success, false);
  assert.equal(
    observationSchema.safeParse({ ...value, intervention: "AGITATION" })
      .success,
    true,
  );
});
test("DAP uses total final volume, 20 g/hL", () =>
  assert.equal(levain.calculateLevainFeeding(parameters).dapKg, 0.08));
test("liqueur tracks saccharose and dissolution wine", () => {
  assert.equal(typeof liqueur.calculateLiqueurPreparation, "function");
  const value = liqueur.calculateLiqueurPreparation(1, 530, 11);
  assert.equal(value.sugarKg, 50);
  assert.equal(value.dissolutionWineVolumeHl, 0.685);
  assert.ok(Math.abs(value.alcoholPct - 7.535) < 1e-8);
});
test("weekend uses civil days across daylight saving time", () => {
  assert.equal(typeof planning.calculateLevainPlanning, "function");
  const rows = planning.calculateLevainPlanning(
    [
      { date: "2026-10-23", baseWineVolumeHl: 100 },
      { date: "2026-10-26", baseWineVolumeHl: 100 },
    ],
    10,
    16,
  );
  assert.equal(rows[0].intervalDays, 3);
  assert.equal(rows[0].morningVolumeHl, 14.746);
  assert.equal(rows[1].morningVolumeHl, 10);
});
test("legacy levain is not ready and generic mutation cannot qualify it", () => {
  assert.equal(typeof levain.getLevainState, "function");
  assert.equal(
    levain.getLevainState({ status: "ACTIF", qualiteLot: "LEVAIN" }),
    "A_QUALIFIER",
  );
  assert.throws(
    () =>
      levain.assertGenericLotMutationAllowed(
        { status: "ACTIF", qualiteLot: "LEVAIN" },
        "status",
      ),
    (e) => e.statusCode === 409,
  );
});
test("a mixtion cannot bypass its recipe through generic volume correction", () => {
  assert.throws(
    () =>
      levain.assertGenericLotMutationAllowed(
        { status: "ASSEMBLE", qualiteLot: "MIXTION_TIRAGE" },
        "volume",
      ),
    (e) => e.statusCode === 409,
  );
});
test("measured 23 hours are projected onto next 24 hours", () => {
  const result = levain.calculateLevainFeeding({
    ...parameters,
    remainingVolumeHl: 18.6,
    finalVolumeHl: 23.8,
    previousDensity: 1005,
    currentDensity: 998,
    wineAlcoholPct: 11,
    currentMeasuredAt: "2026-10-02T07:00:00Z",
    nextWithdrawalAt: "2026-10-03T07:00:00Z",
  });
  assert.ok(
    Math.abs(result.projectedConsumedSugarGPerL - (17.5 * 24) / 23) < 1e-8,
  );
  assert.equal(result.dapKg, 0.476);
});
test("explicit residual sugar and alcohol affect the recipe", () => {
  const a = levain.calculateLevainFeeding(parameters);
  const b = levain.calculateLevainFeeding({
    ...parameters,
    remainingSugarGPerL: 10,
    levainAlcoholPct: 11.5,
  });
  assert.ok(b.liqueurVolumeHl > a.liqueurVolumeHl);
  assert.ok(b.wineVolumeHl > a.wineVolumeHl);
  assert.equal(
    levain.calculateLevainFeeding({
      ...parameters,
      currentMeasuredAt: parameters.previousMeasuredAt,
    }),
    null,
  );
});
test("mixtion conserves GF sugar and dissolved sugar volume", () => {
  assert.equal(typeof mixtion.calculateMixtionRecipe, "function");
  const r = mixtion.calculateMixtionRecipe({
    baseVolumeHl: 10,
    levainVolumeHl: 0.3,
    baseSugarGPerL: 1,
    levainSugarGPerL: 20,
    targetSugarGPerL: 25.4,
    sugarSource: "SUCRE",
  });
  assert.ok(Math.abs(r.volumeHl - (10.3 + 0.0063 * r.sugarKg)) < 0.001);
  assert.ok(
    Math.abs(
      (1000 + 600 + 1060 * r.sugarKg) / (1030 + 0.63 * r.sugarKg) - 25.4,
    ) < 0.001,
  );
});
