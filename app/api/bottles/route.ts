import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { listBottleLotsQuerySchema } from '@/server/modules/bottles/bottle.schemas';
import { BottleModuleService } from '@/server/modules/bottles/bottle.service';
import { logger } from '@/server/shared/logger';
import { assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, ['ADMIN', 'CHEF_CAVE', 'CAVISTE', 'LECTURE_SEULE']);
    const { searchParams } = new URL(request.url);
    const payload = listBottleLotsQuerySchema.parse({ id: searchParams.get('id') ?? undefined });
    const bottles = await BottleModuleService.list(payload, actor);

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
  const message =
    'La suppression physique d’un lot bouteille est désactivée pour préserver la traçabilité. Utilise une future opération d’archivage ou d’annulation contrôlée.';

  logger.warn({
    action: 'bottles.delete.disabled',
    requestId,
    details: { message },
  });

  return NextResponse.json(
    {
      error: 'METHOD_NOT_ALLOWED',
      message,
    },
    {
      status: 405,
      headers: {
        Allow: 'GET',
        'x-request-id': requestId,
      },
    },
  );
}
