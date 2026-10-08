import "server-only";
import { Prisma } from "@prisma/client";
import { BusinessLogicError } from "@/lib/errors";
import type { RequestActor } from "@/server/shared/request-context";
export type ProductDebit = {
  productId: number;
  quantity: number;
  unit: string;
  kind: "LSA" | "SUGAR" | "DAP" | "LIQUEUR" | "OTHER";
};
export type RecipeDebits = {
  lots: Array<{ lotId: number; volumeHl: number; expectedVolumeHl?: number }>;
  products: ProductDebit[];
};
export const decimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const units: Record<string, { dimension: string; factor: number }> = {
  g: { dimension: "mass", factor: 0.001 },
  kg: { dimension: "mass", factor: 1 },
  l: { dimension: "volume", factor: 0.01 },
  hl: { dimension: "volume", factor: 1 },
};
export function convertStockQuantity(
  quantity: number,
  from: string,
  to: string,
): number {
  const a = units[from.trim().toLowerCase()],
    b = units[to.trim().toLowerCase()];
  if (
    !a ||
    !b ||
    a.dimension !== b.dimension ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  )
    throw new BusinessLogicError(
      "Quantité ou unité d’intrant incompatible.",
      400,
    );
  const value = Number(((quantity * a.factor) / b.factor).toFixed(3));
  if (value <= 0)
    throw new BusinessLogicError(
      "Quantité inférieure à la précision de stock.",
      400,
    );
  return value;
}
export async function consumeRecipe(
  tx: Prisma.TransactionClient,
  actor: RequestActor,
  eventId: number,
  input: RecipeDebits,
) {
  const lotGroups = new Map<
    number,
    { volume: Prisma.Decimal; expected?: number }
  >();
  for (const item of input.lots) {
    if (
      !Number.isFinite(item.volumeHl) ||
      item.volumeHl <= 0 ||
      decimal(item.volumeHl).lte(0)
    )
      throw new BusinessLogicError("Volume de prélèvement invalide.", 400);
    const previous = lotGroups.get(item.lotId);
    if (
      previous?.expected !== undefined &&
      item.expectedVolumeHl !== undefined &&
      previous.expected !== item.expectedVolumeHl
    )
      throw new BusinessLogicError("Volumes attendus contradictoires.", 400);
    lotGroups.set(item.lotId, {
      volume: (previous?.volume ?? new Prisma.Decimal(0)).plus(
        decimal(item.volumeHl),
      ),
      expected: item.expectedVolumeHl ?? previous?.expected,
    });
  }
  const lots = await tx.lot.findMany({
    where: {
      organizationId: actor.organizationId,
      id: { in: [...lotGroups.keys()] },
    },
    include: { currentContainer: true },
    orderBy: { id: "asc" },
  });
  if (lots.length !== lotGroups.size)
    throw new BusinessLogicError(
      "Lot introuvable dans votre organisation.",
      404,
    );
  const products = await tx.product.findMany({
    where: {
      organizationId: actor.organizationId,
      id: { in: [...new Set(input.products.map((p) => p.productId))] },
    },
    orderBy: { id: "asc" },
  });
  const productGroups = new Map<
    number,
    { quantity: Prisma.Decimal; kind: string }
  >();
  for (const item of input.products) {
    const product = products.find((p) => p.id === item.productId);
    if (!product)
      throw new BusinessLogicError(
        "Produit introuvable dans votre organisation.",
        404,
      );
    if (product.category.toLowerCase() !== "intrants")
      throw new BusinessLogicError(
        "Le produit sélectionné doit être un intrant.",
        400,
      );
    const quantity = decimal(
      convertStockQuantity(item.quantity, item.unit, product.unit),
    );
    const group = productGroups.get(item.productId);
    productGroups.set(item.productId, {
      quantity: (group?.quantity ?? new Prisma.Decimal(0)).plus(quantity),
      kind: item.kind,
    });
  }
  for (const lot of lots) {
    const group = lotGroups.get(lot.id)!;
    if (
      lot.currentVolumeUnit !== "hL" ||
      ["ARCHIVE", "TIRE", "MIS_EN_BOUTEILLE"].includes(lot.status)
    )
      throw new BusinessLogicError("Lot source inutilisable.", 409);
    if (
      group.expected !== undefined &&
      !lot.currentVolume.equals(decimal(group.expected))
    )
      throw new BusinessLogicError("Le volume source a changé.", 409);
    if (lot.currentVolume.lt(group.volume))
      throw new BusinessLogicError(
        "Volume insuffisant dans le lot source.",
        409,
      );
  }
  for (const product of products)
    if (product.currentStock.lt(productGroups.get(product.id)!.quantity))
      throw new BusinessLogicError(`Stock insuffisant : ${product.name}.`, 409);
  const lotDebits = [];
  for (const lot of lots) {
    const quantity = lotGroups.get(lot.id)!.volume,
      remaining = lot.currentVolume.minus(quantity);
    const result = await tx.lot.updateMany({
      where: {
        id: lot.id,
        organizationId: actor.organizationId,
        currentVolume: lot.currentVolume,
        status: lot.status,
      },
      data: {
        currentVolume: remaining,
        ...(remaining.isZero()
          ? { status: "ARCHIVE", currentContainerId: null }
          : {}),
      },
    });
    if (result.count !== 1)
      throw new BusinessLogicError("Le volume source a changé.", 409);
    if (remaining.isZero() && lot.currentContainerId) {
      const others = await tx.lot.count({
        where: {
          organizationId: actor.organizationId,
          currentContainerId: lot.currentContainerId,
          currentVolume: { gt: 0 },
        },
      });
      if (!others)
        await tx.container.updateMany({
          where: {
            id: lot.currentContainerId,
            organizationId: actor.organizationId,
          },
          data: { status: "EN_NETTOYAGE" },
        });
    }
    lotDebits.push({
      lotId: lot.id,
      volumeHl: Number(quantity),
      remainingVolumeHl: Number(remaining),
      containerId: lot.currentContainerId,
    });
  }
  const productDebits = [];
  for (const product of products) {
    const { quantity, kind } = productGroups.get(product.id)!;
    const changed = await tx.product.updateMany({
      where: {
        id: product.id,
        organizationId: actor.organizationId,
        currentStock: { gte: quantity },
      },
      data: { currentStock: { decrement: quantity } },
    });
    if (changed.count !== 1)
      throw new BusinessLogicError(
        "Le stock a changé pendant l’opération.",
        409,
      );
    const intrant = await tx.intrant.upsert({
      where: { code: `INTRANT-PRODUCT-${product.id}` },
      create: {
        code: `INTRANT-PRODUCT-${product.id}`,
        name: product.name,
        category: product.subCategory,
        mainUnit: product.unit,
      },
      update: {},
    });
    await tx.lotEventIntrant.create({
      data: { eventId, intrantId: intrant.id, quantity, unit: product.unit },
    });
    const movement = await tx.stockMovement.create({
      data: {
        organizationId: actor.organizationId,
        productId: product.id,
        type: "OUT",
        quantity,
        note: `Événement ${eventId} · ${kind}`,
        operator: actor.email,
      },
    });
    productDebits.push({
      productId: product.id,
      name: product.name,
      quantity: Number(quantity),
      unit: product.unit,
      kind,
      movementId: movement.id,
      intrantId: intrant.id,
    });
  }
  return { lotDebits, productDebits };
}
