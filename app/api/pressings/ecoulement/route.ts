import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { EcoulementSchema } from '../../../../validations/pressings.schema';
import { PressingService } from '../../../../services/pressings.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = EcoulementSchema.parse(await request.json());
    const result = await PressingService.ecoulement(payload);

    logger.info({
      action: 'pressings.ecoulement.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { pressingId: result?.pressing?.id },
    });

    return NextResponse.json(result, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'pressings.ecoulement.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    const message = error instanceof Error ? error.message : 'unknown_error';
    const status = message.includes('ALREADY_APPLIED') ? 400 : 500;

    logger.error({
      action: 'pressings.ecoulement.post.unhandled_error',
      requestId,
      details: { error: message },
    });

    return NextResponse.json(
      { error: status === 400 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_SERVER_ERROR', message },
      { status, headers: { 'x-request-id': requestId } },
    );
  }
}
