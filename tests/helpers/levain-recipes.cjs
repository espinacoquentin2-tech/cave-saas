const { randomUUID } = require("node:crypto");
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
module.exports = {
  product,
  creation,
  snapshot,
  qualification,
  measures,
  parameters,
};
