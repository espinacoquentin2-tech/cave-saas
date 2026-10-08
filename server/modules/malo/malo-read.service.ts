import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/shared/prisma";
import { BusinessLogicError } from "@/lib/errors";
import { isMaloSourceEligible } from "@/lib/malo";
import { buildMaloSchedule } from "@/lib/malo-protocols";
import type { RequestActor } from "@/server/shared/request-context";
import type {
  MaloWorkspace,
  MaloDossierView,
  MaloLotView,
  MaloRole,
} from "@/lib/malo-types";
import { readLot, snapshotOf, protocolOf, type Tx } from "./malo-operation";
import { readMaloControl, analysisView } from "./malo-control.service";
async function lotView(
  tx: Tx,
  id: number,
  actor: RequestActor,
): Promise<MaloLotView> {
  const l = await readLot(tx, id, actor),
    analyses = await tx.analysis.findMany({
      where: { lotId: id, organizationId: actor.organizationId },
      orderBy: [{ analysisDate: "desc" }, { id: "desc" }],
    }),
    snapshot = await snapshotOf(tx, l, actor);
  const originEvent = await tx.lotEvent.findFirst({
    where: {
      organizationId: actor.organizationId,
      eventType: "PRESSURAGE",
      lots: { some: { lotId: id } },
    },
    orderBy: { id: "asc" },
  });
  const originMetadata = originEvent?.metadata as Record<
    string,
    unknown
  > | null;
  const originText = [
    l.qualiteLot,
    l.notes,
    originMetadata?.note,
    originMetadata?.fraction,
  ]
    .filter(Boolean)
    .join(" ");
  const homogeneous = l.maloCompositionEventId
    ? await tx.lotEvent.findFirst({
        where: {
          organizationId: actor.organizationId,
          eventType: "HOMOGENEISATION_PCM",
          lots: { some: { lotId: id } },
          metadata: {
            path: ["compositionEventId"],
            equals: l.maloCompositionEventId,
          },
        },
      })
    : null;
  return {
    id: l.id,
    year: l.year,
    name: l.businessCode,
    role: l.maloRole as MaloRole | null,
    status: l.status,
    volumeHl: Number(l.currentVolume),
    containerId: l.currentContainerId,
    containerName: l.currentContainer?.displayName ?? "",
    capacityHl:
      Number(l.currentContainer?.capacityValue ?? 0) /
      (l.currentContainer?.capacityUnit === "L" ? 100 : 1),
    occupiedVolumeHl: l.currentContainerId
      ? Number(
          (
            await tx.lot.aggregate({
              where: {
                currentContainerId: l.currentContainerId,
                organizationId: actor.organizationId,
                currentVolume: { gt: 0 },
              },
              _sum: { currentVolume: true },
            })
          )._sum.currentVolume ?? 0,
        )
      : 0,
    snapshot,
    analyses: analyses.map(analysisView),
    origin: /taille/i.test(originText)
      ? "Taille"
      : /cuvée|cuvee/i.test(originText)
        ? "Cuvée"
        : "Origine non renseignée",
    homogenized: !!homogeneous,
    ...(l.maloRole && l.maloPreparationId
      ? {
          control: await readMaloControl(
            tx,
            l.maloPreparationId,
            l.maloRole as MaloRole,
            actor,
          ),
        }
      : {}),
  };
}
async function dossierView(
  tx: Tx,
  id: number,
  actor: RequestActor,
): Promise<MaloDossierView> {
  const p = await tx.maloPreparation.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { lots: true },
  });
  if (!p) throw new BusinessLogicError("Dossier introuvable.", 404);
  const events = await tx.lotEvent.findMany({
      where: {
        organizationId: actor.organizationId,
        metadata: { path: ["preparationId"], equals: id },
      },
      orderBy: { id: "desc" },
    }),
    protocol = protocolOf(p.protocolSnapshot);
  const firstIncorp = events
      .filter((e) => e.eventType === "INCORPORATION_MR")
      .at(-1),
    distributions = events.filter((e) => e.eventType === "ENSEMENCEMENT_MALO");
  const schedule = buildMaloSchedule(protocol, {
    startedAt:
      events
        .filter((e) => e.eventType === "PREPARATION_MR")
        .at(-1)
        ?.eventDatetime.toISOString() ?? p.createdAt.toISOString(),
    pcmInoculatedAt: firstIncorp?.eventDatetime.toISOString(),
  });
  for (const e of distributions)
    schedule.push(
      ...buildMaloSchedule(protocol, {
        startedAt: p.createdAt.toISOString(),
        distributedAt: e.eventDatetime.toISOString(),
      }).filter((x) => x.kind === "CUVES"),
    );
  return {
    id: p.id,
    name: p.name,
    year: p.year,
    status: p.status,
    notes: p.notes,
    plannedVolumeHl: Number(p.plannedVolumeHl),
    dosePct: Number(p.dosePct),
    protocol,
    plannedDestinations: p.plannedDestinations as Array<{
      lotId: number;
      dosePct: number;
    }>,
    lots: await Promise.all(p.lots.map((l) => lotView(tx, l.id, actor))),
    events: events.map((e) => ({
      ...e,
      eventDatetime: e.eventDatetime.toISOString(),
      metadata: (e.metadata ?? {}) as Record<string, unknown>,
    })),
    schedule,
  };
}
export async function readMaloDossier(id: number, actor: RequestActor) {
  return prisma.$transaction((tx) => dossierView(tx, id, actor), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: 20000,
  });
}
export async function listMalo(actor: RequestActor): Promise<MaloWorkspace> {
  return prisma.$transaction(
    async (tx) => {
      const dossiers = await tx.maloPreparation.findMany({
          where: { organizationId: actor.organizationId },
          orderBy: { id: "desc" },
        }),
        lots = await tx.lot.findMany({
          where: {
            organizationId: actor.organizationId,
            currentVolume: { gt: 0 },
            currentContainerId: { not: null },
          },
          include: { currentContainer: true },
        }),
        containers = await tx.container.findMany({
          where: { organizationId: actor.organizationId, status: "VIDE" },
          include: {
            currentLots: { where: { currentVolume: { gt: 0 } } },
            children: true,
          },
        }),
        products = await tx.product.findMany({
          where: {
            organizationId: actor.organizationId,
            category: { equals: "Intrants", mode: "insensitive" },
          },
          orderBy: { name: "asc" },
        });
      const sources = await Promise.all(
        lots
          .filter((l) =>
            isMaloSourceEligible({
              ...l,
              currentVolume: Number(l.currentVolume),
            }),
          )
          .map((l) => lotView(tx, l.id, actor)),
      );
      return {
        items: await Promise.all(
          dossiers.map((p) => dossierView(tx, p.id, actor)),
        ),
        sources,
        targets: sources,
        containers: containers
          .filter(
            (c) =>
              !c.currentLots.length &&
              !c.children.length &&
              ["hL", "L"].includes(c.capacityUnit),
          )
          .map((c) => ({
            id: c.id,
            name: c.displayName,
            capacityHl:
              Number(c.capacityValue) / (c.capacityUnit === "L" ? 100 : 1),
            usage: c.usage,
          })),
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          currentStock: Number(p.currentStock),
          subCategory: p.subCategory,
        })),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30000,
    },
  );
}
