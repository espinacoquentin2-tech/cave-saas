const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { calculateLevainFeeding } = fs.existsSync('lib/levain.ts') ? require('../../lib/levain.ts') : {};
const input = { remainingVolumeHl: 2, finalVolumeHl: 4, previousDensity: 1000, currentDensity: 1000, liqueurSugarGPerL: 600, wineAlcoholPct: 13 };

test('le nourrissage conserve le bilan entre levain, vin, liqueur et eau', () => {
  assert.equal(typeof calculateLevainFeeding, 'function');
  const result = calculateLevainFeeding(input);
  assert.equal(result.wineVolumeHl, 1.811);
  assert.equal(result.liqueurVolumeHl, 0.067);
  assert.equal(result.waterVolumeHl, 0.122);
  assert.equal(result.addedVolumeHl, 2);
});
for (const [label, change] of [
  ['un volume final inférieur au levain restant', { finalVolumeHl: 1 }],
  ['un degré de vin nul', { wineAlcoholPct: 0 }],
  ['une densité qui augmente', { currentDensity: 1001 }],
  ['une recette qui exige un volume d’eau négatif', { wineAlcoholPct: 12 }],
  ['une valeur non finie', { remainingVolumeHl: NaN }],
]) {
  test(`le calcul refuse ${label}`, () => {
    assert.equal(typeof calculateLevainFeeding, 'function');
    assert.equal(calculateLevainFeeding({ ...input, ...change }), null);
  });
}
