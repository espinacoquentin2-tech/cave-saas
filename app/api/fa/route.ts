import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
<<<<<<< HEAD
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { saveFaTourSchema } from '@/server/modules/fa/fa.schemas';
import { FaModuleService } from '@/server/modules/fa/fa.service';
import { logger } from '@/server/shared/logger';
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';
=======
import { BusinessLogicError } from '@/lib/errors';
import { saveFaTourSchema } from '@/server/modules/fa/fa.schemas';
import { FaModuleService } from '@/server/modules/fa/fa.service';
import { logger } from '@/server/shared/logger';
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
    const payload = saveFaTourSchema.parse(await request.json());
    const result = await FaModuleService.saveTour(payload, actor);

    logger.info({
      action: 'fa.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: result.count },
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        data: result,
      },
      {
        status: 201,
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
<<<<<<< HEAD
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      logger.warn({
        action: 'auth.rejected',
        requestId,
        details: { message: error.message },
=======
    if (error instanceof ZodError) {
      logger.warn({
        action: 'fa.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
>>>>>>> main
      });

      return NextResponse.json(
        {
<<<<<<< HEAD
          error: error instanceof UnauthorizedError ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: error.message,
        },
        {
          status: error.statusCode,
=======
          error: 'VALIDATION_ERROR',
          details: error.flatten(),
        },
        {
          status: 400,
>>>>>>> main
          headers: { 'x-request-id': requestId },
        },
      );
    }

<<<<<<< HEAD
    if (error instanceof ZodError) {
      logger.warn({
        action: 'fa.post.validation_failed',
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
    if (error instanceof BusinessLogicError) {
      logger.warn({
        action: 'fa.post.business_rejected',
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
      action: 'fa.post.unhandled_error',
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

