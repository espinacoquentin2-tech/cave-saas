const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { calculateLevainFeeding } = fs.existsSync("lib/levain.ts")
  ? require("../../lib/levain.ts")
  : {};
const input = {
  remainingVolumeHl: 2,
  finalVolumeHl: 4,
  previousDensity: 1000,
  currentDensity: 1000,
  liqueurSugarGPerL: 600,
  wineAlcoholPct: 13,
  remainingSugarGPerL: 20,
  levainAlcoholPct: 12,
  targetAlcoholPct: 12,
  liqueurAlcoholPct: 6.8,
  previousMeasuredAt: "2026-10-01T08:00:00Z",
  currentMeasuredAt: "2026-10-02T08:00:00Z",
  nextWithdrawalAt: "2026-10-03T08:00:00Z",
};

test("le nourrissage conserve le bilan entre levain, vin, liqueur et eau", () => {
  assert.equal(typeof calculateLevainFeeding, "function");
  const result = calculateLevainFeeding(input);
  assert.equal(result.wineVolumeHl, 1.811);
  assert.equal(result.liqueurVolumeHl, 0.067);
  assert.equal(result.waterVolumeHl, 0.122);
  assert.equal(result.addedVolumeHl, 2);
});
for (const [label, change] of [
  ["un volume final inférieur au levain restant", { finalVolumeHl: 1 }],
  ["un degré de vin nul", { wineAlcoholPct: 0 }],
  ["une densité qui augmente", { currentDensity: 1001 }],
  ["une recette qui exige un volume d’eau négatif", { wineAlcoholPct: 12 }],
  ["une valeur non finie", { remainingVolumeHl: NaN }],
]) {
  test(`le calcul refuse ${label}`, () => {
    assert.equal(typeof calculateLevainFeeding, "function");
    assert.equal(calculateLevainFeeding({ ...input, ...change }), null);
  });
}
