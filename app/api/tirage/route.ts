import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { TirageModuleService } from '@/server/modules/tirage/tirage.service';
import { createTirageSchema } from '@/server/modules/tirage/tirage.schemas';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = createTirageSchema.parse(await request.json());
    const result = await TirageModuleService.execute(payload, actor);

    logger.info({
      action: 'tirage.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: {
        bottleLotId: result.bottleLotId,
        bottleLotCode: result.bottleLotCode,
        remainingVolume: result.remainingVolume,
      },
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        ...result,
      },
      {
        status: 201,
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'tirage.post.validation_failed',
        requestId,
        details: {
          issues: error.flatten(),
        },
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

    if (error instanceof BusinessLogicError) {
      logger.warn({
        action: 'tirage.post.business_rejected',
        requestId,
        details: {
          message: error.message,
        },
      });

      return NextResponse.json(
        {
          error: 'BUSINESS_RULE_VIOLATION',
          message: error.message,
        },
        {
          status: error.statusCode,
          headers: { 'x-request-id': requestId },
        },
      );
    }

    logger.error({
      action: 'tirage.post.unhandled_error',
      requestId,
      details: {
        error: error instanceof Error ? error.message : 'unknown_error',
      },
    });

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
      },
      {
        status: 500,
        headers: { 'x-request-id': requestId },
      },
    );
  }
}
