import "server-only";
import { prisma } from "@/server/shared/prisma";
import type { RequestActor } from "@/server/shared/request-context";
import { getLevainState } from "@/lib/levain";
import { MIXTION_NON_COMPOSITION_EVENTS } from "@/lib/mixtion";
import { isTirageEligibleLotStatus } from "@/lib/tirage";
import { MUTATION_EXCLUSIONS } from "./levain-operation";
export async function listLevains(actor: RequestActor) {
  const [lots, products, containers] = await Promise.all([
    prisma.lot.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        currentContainer: true,
        analyses: {
          where: { organizationId: actor.organizationId },
          orderBy: { analysisDate: "desc" },
        },
        lotEventLots: {
          where: { event: { organizationId: actor.organizationId } },
          include: { event: true },
          orderBy: { eventId: "desc" },
        },
      },
      orderBy: { id: "desc" },
    }),
    prisma.product.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.container.findMany({
      where: { organizationId: actor.organizationId, capacityUnit: "hL" },
      include: { currentLots: { where: { currentVolume: { gt: 0 } } } },
    }),
  ]);
  const view = (lot: (typeof lots)[number]) => ({
    lotId: lot.id,
    name: lot.businessCode,
    containerId: lot.currentContainerId,
    containerName: lot.currentContainer?.displayName ?? "",
    status: lot.status,
    state: getLevainState(
      lot,
      /LEVAIN/i.test(lot.currentContainer?.displayName ?? ""),
    ),
    volumeHl: Number(lot.currentVolume),
    capacityHl: Number(lot.currentContainer?.capacityValue ?? 0),
    lastMutationEventId:
      lot.lotEventLots.find(
        (link) => !MUTATION_EXCLUSIONS.includes(link.event.eventType),
      )?.eventId ?? null,
    events: lot.lotEventLots.map((link) => link.event),
    analyses: lot.analyses,
  });
  return {
    items: lots
      .filter((l) =>
        getLevainState(
          l,
          /LEVAIN/i.test(l.currentContainer?.displayName ?? ""),
        ),
      )
      .map(view),
    wines: lots
      .filter(
        (l) =>
          isTirageEligibleLotStatus(l.status) &&
          !getLevainState(
            l,
            /LEVAIN/i.test(l.currentContainer?.displayName ?? ""),
          ) &&
          l.qualiteLot !== "MIXTION_TIRAGE" &&
          l.currentContainerId &&
          l.currentVolume.gt(0),
      )
      .map(view),
    mixtions: lots
      .filter((l) => l.qualiteLot === "MIXTION_TIRAGE")
      .map((l) => ({
        ...view(l),
        creationEventId:
          l.lotEventLots.find(
            (link) => link.event.eventType === "CREATION_MIXTION",
          )?.eventId ?? null,
        compositionEventId:
          l.lotEventLots.find(
            (link) =>
              !MIXTION_NON_COMPOSITION_EVENTS.includes(link.event.eventType),
          )?.eventId ?? null,
        checked: (() => {
          const checked = l.lotEventLots.find(
            (link) => link.event.eventType === "CONTROLE_MIXTION",
          );
          return (
            !!checked &&
            !l.lotEventLots.some(
              (link) =>
                link.eventId > checked.eventId &&
                !MIXTION_NON_COMPOSITION_EVENTS.includes(link.event.eventType),
            )
          );
        })(),
      })),
    products: products.map((p) => ({
      ...p,
      currentStock: Number(p.currentStock),
    })),
    emptyTanks: containers
      .filter((c) => !c.currentLots.length && c.status === "VIDE")
      .map((c) => ({
        id: c.id,
        name: c.displayName,
        capacityHl: Number(c.capacityValue),
      })),
  };
}
