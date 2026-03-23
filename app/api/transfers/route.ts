import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import {
  createTransferSchema,
  transferActorSchema,
} from '@/server/modules/transfers/transfer.schemas';
import { TransferService } from '@/server/modules/transfers/transfer.service';
import { logger } from '@/server/shared/logger';

const normalizeRole = (roleHeader: string | null) => {
  switch (roleHeader?.trim().toUpperCase()) {
    case 'ADMIN':
      return 'ADMIN';
    case 'CHEF DE CAVE':
    case 'CHEF_CAVE':
      return 'CHEF_CAVE';
    case 'CAVISTE':
      return 'CAVISTE';
    default:
      return null;
  }
};

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  try {
    const actor = transferActorSchema.parse({
      email: request.headers.get('x-user-email'),
      role: normalizeRole(request.headers.get('x-user-role')),
    });

    const payload = createTransferSchema.parse(await request.json());

    const result = await TransferService.execute(payload, actor);

    logger.info({
      action: 'transfer.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: {
        eventId: result.eventId,
        sourceLotId: result.sourceLotId,
        createdLotIds: result.createdLotIds,
      },
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
    if (error instanceof ZodError) {
      logger.warn({
        action: 'transfer.post.validation_failed',
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
        action: 'transfer.post.business_rejected',
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
      action: 'transfer.post.unhandled_error',
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
