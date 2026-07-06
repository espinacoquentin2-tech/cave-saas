import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { logger } from '@/server/shared/logger';
import { getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);

    return NextResponse.json(
      {
        user: {
          id: actor.userId,
          email: actor.email,
        },
        organization: {
          id: actor.organizationId,
          name: actor.organizationName,
          slug: actor.organizationSlug,
        },
        roleKey: actor.roleKey,
      },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      logger.warn({
        action: 'me.get.rejected',
        requestId,
        details: { message: error.message },
      });

      return NextResponse.json(
        {
          error: error instanceof UnauthorizedError ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: error.message,
        },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'me.get.unhandled_error',
      requestId,
      details: {
        error: error instanceof Error ? error.message : 'unknown_error',
      },
    });

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
