import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { calculateLevainFeeding } from '@/lib/levain';
import { isTirageEligibleLotStatus } from '@/lib/tirage';
import { assertRole, WRITE_ROLES, type RequestActor } from '@/server/shared/request-context';
import { LevainRepository } from './levain.repository';
import { createLevainSchema, feedLevainSchema, type CreateLevainInput, type FeedLevainInput } from './levain.schemas';

type Tx = Prisma.TransactionClient;
const decimal = (value: number) => new Prisma.Decimal(value.toFixed(3));

async function getTank(tx: Tx, id: number, organizationId: number) {
  const tank = await tx.container.findFirst({ where: { id, organizationId }, include: { currentLots: { where: { currentVolume: { gt: 0 } }, include: { components: true } } } });
  if (!tank) throw new BusinessLogicError('Cuve introuvable dans votre organisation.', 404);
  if (tank.capacityUnit !== 'hL' || tank.currentLots.some(lot => lot.currentVolumeUnit !== 'hL' || lot.organizationId !== organizationId)) {
    throw new BusinessLogicError('La cuve et ses lots doivent utiliser des volumes en hL dans la même organisation.', 409);
  }
  if (tank.currentLots.length !== 1) throw new BusinessLogicError('La cuve doit contenir exactement un lot actif de volume positif.', 409);
  const lot = tank.currentLots[0];
  if (['ARCHIVE', 'TIRE', 'MIS_EN_BOUTEILLE'].includes(lot.status)) throw new BusinessLogicError('Ce lot ne peut plus être utilisé.', 409);
  return { tank, lot };
}

async function getSource(tx: Tx, id: number, organizationId: number) {
  const source = await getTank(tx, id, organizationId);
  if (!isTirageEligibleLotStatus(source.lot.status) || source.lot.qualiteLot === 'LEVAIN'
    || /LEVAIN|BOURBE|REBECHE|\bLIES\b/i.test(`${source.tank.type} ${source.tank.displayName}`)) {
    throw new BusinessLogicError('La source doit être un lot de vin de base ou d’assemblage, distinct du levain.', 409);
  }
  return source;
}

async function reserveRequest(tx: Tx, key: string, action: string, actor: RequestActor) {
  if (await tx.idempotencyRecord.findUnique({ where: { key } })) throw new BusinessLogicError('Cette opération a déjà été enregistrée.', 409);
  await tx.idempotencyRecord.create({ data: { key, action, userId: `${actor.organizationId}:${actor.userId}` } });
}

async function consumeSource(tx: Tx, source: Awaited<ReturnType<typeof getSource>>, volume: number, actor: RequestActor) {
  const remaining = source.lot.currentVolume.minus(decimal(volume));
  if (remaining.isNegative()) throw new BusinessLogicError('Volume insuffisant dans le lot source.', 409);
  const updated = await tx.lot.updateMany({
    where: { id: source.lot.id, organizationId: actor.organizationId, currentVolume: source.lot.currentVolume },
    data: { currentVolume: remaining, ...(remaining.isZero() ? { status: 'ARCHIVE', currentContainerId: null } : {}) },
  });
  if (updated.count !== 1) throw new BusinessLogicError('Le volume source a changé. Actualisez la cuverie.', 409);
  if (remaining.isZero()) await tx.container.updateMany({ where: { id: source.tank.id, organizationId: actor.organizationId }, data: { status: 'EN_NETTOYAGE' } });
  return Number(remaining);
}

async function trace(tx: Tx, action: string, actor: RequestActor, sourceLotId: number, levainLotId: number, sourceTankId: number, levainTankId: number, wine: number, added: number, metadata: Prisma.InputJsonObject) {
  const event = await tx.lotEvent.create({ data: {
    organizationId: actor.organizationId, operatorUserId: actor.userId, eventType: action,
    comment: action === 'CREATION_LEVAIN' ? 'Création du levain depuis le vin source' : 'Nourrissage du levain',
    metadata: { ...metadata, operation: action, sourceLotId, levainLotId, sourceContainerId: sourceTankId, levainContainerId: levainTankId },
    lots: { create: [{ lotId: sourceLotId, roleInEvent: 'SOURCE', volumeChange: decimal(-wine) }, { lotId: levainLotId, roleInEvent: 'CIBLE', volumeChange: decimal(added) }] },
    containers: { create: [{ containerId: sourceTankId, roleInEvent: 'SOURCE' }, { containerId: levainTankId, roleInEvent: 'CIBLE' }] },
  } });
  await tx.auditLog.create({ data: { organizationId: actor.organizationId, action, userId: actor.email, details: JSON.stringify({ eventId: event.id, ...metadata }) } });
  return event.id;
}

export class LevainService {
  static async create(input: CreateLevainInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    input = createLevainSchema.parse(input);
    return LevainRepository.withTransaction(async tx => {
      await reserveRequest(tx, input.idempotencyKey, 'CREATION_LEVAIN', actor);
      const source = await getSource(tx, input.sourceContainerId, actor.organizationId);
      const remainingSourceVolumeHl = await consumeSource(tx, source, input.volumeHl, actor);
      const suffix = randomUUID();
      const tank = await tx.container.create({ data: { organizationId: actor.organizationId, code: `LEV-${suffix}`, displayName: 'Cuve Levain (Actif)', type: 'CUVE_INOX', capacityValue: decimal(input.capacityHl ?? Math.ceil(input.volumeHl * 1.2)), capacityUnit: 'hL', zone: 'Cuverie', status: 'PLEIN' } });
      const lot = await tx.lot.create({ data: {
        organizationId: actor.organizationId, technicalCode: `LEV-${suffix}`, businessCode: `LEV-${source.lot.year}-${suffix.slice(0, 12).toUpperCase()}`, year: source.lot.year,
        mainGrapeCode: source.lot.mainGrapeCode, placeCode: source.lot.placeCode, sequenceNumber: 1,
        status: 'ACTIF', qualiteLot: 'LEVAIN', currentVolume: decimal(input.volumeHl), currentVolumeUnit: 'hL', currentContainerId: tank.id,
        components: { create: source.lot.components.map(component => ({ grapeCode: component.grapeCode, percentage: component.percentage })) },
      } });
      const eventId = await trace(tx, 'CREATION_LEVAIN', actor, source.lot.id, lot.id, source.tank.id, tank.id, input.volumeHl, input.volumeHl, { idempotencyKey: input.idempotencyKey, volumeHl: input.volumeHl });
      return { eventId, levainLotId: lot.id, levainContainerId: tank.id, remainingSourceVolumeHl, levainVolumeHl: input.volumeHl };
    });
  }

  static async feed(input: FeedLevainInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    input = feedLevainSchema.parse(input);
    const calculation = calculateLevainFeeding(input);
    if (!calculation) throw new BusinessLogicError('Les paramètres donnent une recette de nourrissage incohérente.', 400);
    return LevainRepository.withTransaction(async tx => {
      await reserveRequest(tx, input.idempotencyKey, 'ALIMENTATION_LEVAIN', actor);
      const source = await getSource(tx, input.sourceContainerId, actor.organizationId);
      const levain = await getTank(tx, input.levainContainerId, actor.organizationId);
      if (levain.lot.qualiteLot !== 'LEVAIN' && !/LEVAIN/i.test(`${levain.tank.type} ${levain.tank.displayName}`)) throw new BusinessLogicError('La destination n’est pas une cuve de levain.', 409);
      if (!levain.lot.currentVolume.equals(decimal(input.remainingVolumeHl))) throw new BusinessLogicError('Le volume restant du levain a changé. Actualisez la cuverie.', 409);
      if (decimal(input.finalVolumeHl).gt(levain.tank.capacityValue)) throw new BusinessLogicError('La capacité de la cuve de levain est dépassée.', 409);
      const remainingSourceVolumeHl = await consumeSource(tx, source, calculation.wineVolumeHl, actor);
      const updated = await tx.lot.updateMany({ where: { id: levain.lot.id, organizationId: actor.organizationId, currentVolume: levain.lot.currentVolume }, data: { currentVolume: decimal(input.finalVolumeHl), qualiteLot: 'LEVAIN' } });
      if (updated.count !== 1) throw new BusinessLogicError('Le levain a changé. Actualisez la cuverie.', 409);
      const eventId = await trace(tx, 'ALIMENTATION_LEVAIN', actor, source.lot.id, levain.lot.id, source.tank.id, levain.tank.id, calculation.wineVolumeHl, calculation.addedVolumeHl, { idempotencyKey: input.idempotencyKey, parameters: { ...input }, calculation: { ...calculation } });
      return { eventId, levainLotId: levain.lot.id, levainContainerId: levain.tank.id, remainingSourceVolumeHl, levainVolumeHl: input.finalVolumeHl, calculation };
    });
  }
}
