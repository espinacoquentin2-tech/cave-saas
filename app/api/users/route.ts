import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { upsertUserSchema } from '@/server/modules/users/user.schemas';
import { UserModuleService } from '@/server/modules/users/user.service';
import { logger } from '@/server/shared/logger';
import { assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

const handleUpsert = async (request: Request, method: 'POST' | 'PUT') => {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, ['ADMIN', 'CHEF_CAVE']);
    const payload = upsertUserSchema.parse(await request.json());
    const result = await UserModuleService.upsert(payload, actor);

    logger.info({
      action: `users.${method.toLowerCase()}.success`,
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { userId: result.id, targetEmail: result.email },
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        data: result,
      },
      {
        status: method === 'POST' ? 201 : 200,
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: `users.${method.toLowerCase()}.validation_failed`,
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

    if (error instanceof BusinessLogicError) {
      logger.warn({
        action: `users.${method.toLowerCase()}.business_rejected`,
        requestId,
        details: { message: error.message },
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
      action: `users.${method.toLowerCase()}.unhandled_error`,
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
};

export async function POST(request: Request) {
  return handleUpsert(request, 'POST');
}

export async function PUT(request: Request) {
  return handleUpsert(request, 'PUT');
}
