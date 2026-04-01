import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';
=======
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';
>>>>>>> main

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
<<<<<<< HEAD
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, ['ADMIN']);
=======
    const actor = parseRequestActor(request);

    if (actor.role !== 'ADMIN') {
      logger.warn({
        action: 'reset.post.forbidden',
        requestId,
        userEmail: actor.email,
        role: actor.role,
      });

      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: 'Seul un administrateur peut réinitialiser la base.' },
        { status: 403, headers: { 'x-request-id': requestId } },
      );
    }
>>>>>>> main

    await prisma.$transaction(async (tx) => {
      await tx.lotEventLot.deleteMany();
      await tx.lotEventContainer.deleteMany();
      await tx.lotEvent.deleteMany();
      await tx.faReading.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.idempotencyRecord.deleteMany();
      await tx.degustation.deleteMany();

      await tx.bottleLot.deleteMany();
      await tx.lot.deleteMany();

      await tx.pressing.deleteMany();
      await tx.pressoir.deleteMany();
      await tx.maturation.deleteMany();

      await tx.product.updateMany({ data: { currentStock: 0 } });
      await tx.container.updateMany({ data: { status: 'VIDE', notes: null } });
    });
<<<<<<< HEAD

    logger.info({
      action: 'reset.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
    });

    return NextResponse.json(
      { success: true, message: 'Réinitialisation complète effectuée. Base de données synchronisée.' },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      logger.warn({
        action: 'auth.rejected',
        requestId,
        details: { message: error.message },
      });

      return NextResponse.json(
        {
          error: error instanceof UnauthorizedError ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: error.message,
        },
        {
          status: error.statusCode,
          headers: { 'x-request-id': requestId },
        },
      );
    }

    if (error instanceof BusinessLogicError) {
      logger.warn({
        action: 'reset.post.business_rejected',
        requestId,
        details: { message: error.message },
      });

      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: error.message },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

=======

    logger.info({
      action: 'reset.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
    });

    return NextResponse.json(
      { success: true, message: 'Réinitialisation complète effectuée. Base de données synchronisée.' },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
>>>>>>> main
    logger.error({
      action: 'reset.post.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
