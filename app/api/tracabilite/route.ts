import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
=======
>>>>>>> main
import { ZodError } from 'zod';
import { TraceabilityRequestSchema } from '../../../validations/tracabilite.schema';
import { TracabiliteService } from '../../../services/tracabilite.service';
import { logger } from '@/server/shared/logger';
<<<<<<< HEAD
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';
=======
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';
>>>>>>> main

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
<<<<<<< HEAD
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
=======
    const actor = parseRequestActor(request);
>>>>>>> main
    const payload = TraceabilityRequestSchema.parse(await request.json());
    const lineage = await TracabiliteService.getLineage(payload);

    logger.info({
      action: 'tracabilite.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { lotCode: payload.lotCode, type: payload.type },
    });

    return NextResponse.json(lineage, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
<<<<<<< HEAD
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

=======
>>>>>>> main
    if (error instanceof ZodError) {
      logger.warn({
        action: 'tracabilite.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'tracabilite.post.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}

