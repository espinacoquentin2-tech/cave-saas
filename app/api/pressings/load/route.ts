import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { ZodError } from 'zod';
import { LoadPressSchema } from '../../../../validations/pressings.schema';
import { PressingService } from '../../../../services/pressings.service';
import { logger } from '@/server/shared/logger';
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = LoadPressSchema.parse(await request.json());
    const result = await PressingService.load(payload);

    logger.info({
      action: 'pressings.load.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { pressId: payload.pressId },
    });

    return NextResponse.json(result, { status: 200, headers: { 'x-request-id': requestId } });
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
        action: 'pressings.load.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    const message = error instanceof Error ? error.message : 'unknown_error';
    const status = message.includes('ALREADY_APPLIED') ? 400 : message.includes('MIX_WARNING') ? 409 : 500;

    logger.error({
      action: 'pressings.load.post.unhandled_error',
      requestId,
      details: { error: message },
    });

    return NextResponse.json(
      { error: status === 500 ? 'INTERNAL_SERVER_ERROR' : 'BUSINESS_RULE_VIOLATION', message },
      { status, headers: { 'x-request-id': requestId } },
    );
  }
}

