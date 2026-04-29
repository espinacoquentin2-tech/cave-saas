import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { adminResetDatabaseSchema } from '@/server/modules/admin/admin-reset.schemas';
import { AdminResetService } from '@/server/modules/admin/admin-reset.service';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenError('Cette fonctionnalité est disponible uniquement en développement.');
    }

    if (process.env.ALLOW_DATABASE_RESET !== 'true') {
      throw new ForbiddenError('ALLOW_DATABASE_RESET doit être positionné à true pour autoriser cette opération.');
    }

    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, ['ADMIN'] as Array<'ADMIN'>);

    const payload = adminResetDatabaseSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await AdminResetService.resetBusinessData(tx);
      const seeded = payload.reseed
        ? await AdminResetService.seedDemoData(tx, { operatorEmail: actor.email })
        : {};

      return {
        success: true as const,
        mode: payload.mode,
        reseed: payload.reseed,
        deleted,
        seeded,
      };
    });

    logger.info({
      action: 'admin.reset-database.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: {
        mode: payload.mode,
        reseed: payload.reseed,
        deleted: result.deleted,
        seeded: result.seeded,
      },
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      logger.warn({
        action: 'admin.reset-database.post.rejected',
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
        action: 'admin.reset-database.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: error.flatten(),
        },
        {
          status: 400,
          headers: { 'x-request-id': requestId },
        },
      );
    }

    logger.error({
      action: 'admin.reset-database.post.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
