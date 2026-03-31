import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { listBottleLotsQuerySchema } from '@/server/modules/bottles/bottle.schemas';
import { BottleModuleService } from '@/server/modules/bottles/bottle.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const { searchParams } = new URL(request.url);
    const payload = listBottleLotsQuerySchema.parse({ id: searchParams.get('id') ?? undefined });
    const bottles = await BottleModuleService.list(payload);

    logger.info({
      action: 'bottles.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: bottles.length },
    });

    return NextResponse.json(bottles, {
      status: 200,
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'bottles.get.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'bottles.get.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    await prisma.$transaction(async (tx) => {
      const bottleLot = await tx.bottleLot.findUnique({ where: { id } });
      if (!bottleLot) return;

      // 1. Nettoyer les liens d'historique
      await tx.bottleEventLink.deleteMany({ where: { bottleLotId: id } });

      // 2. Restituer le vin dans la cuve d'origine !
      if (bottleLot.sourceLotId) {
        const fmtHL = { "37.5cl":0.00375, "75cl":0.0075, "150cl":0.015, "300cl":0.03 };
        const volumeToRestore = bottleLot.initialBottleCount * (fmtHL[bottleLot.formatCode as keyof typeof fmtHL] || 0.0075);
        
        const lot = await tx.lot.findUnique({ where: { id: bottleLot.sourceLotId } });
        if (lot) {
          await tx.lot.update({
            where: { id: bottleLot.sourceLotId },
            data: { 
              currentVolume: Number(lot.currentVolume) + volumeToRestore,
              status: lot.status === 'TIRE' ? 'ACTIF' : lot.status // Réanime le lot s'il était fini
            }
          });
        }
      }

      // 3. Détruire le lot de bouteilles
      await tx.bottleLot.delete({ where: { id } });
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
