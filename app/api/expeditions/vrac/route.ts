import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createVracShipmentSchema } from '@/server/modules/expeditions/vrac.schemas';
import { VracExpeditionService } from '@/server/modules/expeditions/vrac.service';
import { logger, serializeErrorDetails } from '@/server/shared/logger';
import { assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

const VRAC_SHIPMENT_ROLES = ['ADMIN', 'CHEF_CAVE'] as const;

const isBusinessLogicErrorLike = (error: unknown): error is BusinessLogicError =>
  error instanceof BusinessLogicError ||
  (error instanceof Error &&
    error.name === 'BusinessLogicError' &&
    typeof (error as Partial<BusinessLogicError>).statusCode === 'number');

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, [...VRAC_SHIPMENT_ROLES]);
    const payload = createVracShipmentSchema.parse(await request.json());
    const result = await VracExpeditionService.create(payload, actor.email);

    logger.info({
      action: 'expeditions.vrac.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: {
        lineCount: payload.lines.length,
        totalVolumeHl: payload.lines.reduce((sum, line) => sum + line.volumeHl, 0),
        client: payload.client,
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
        action: 'expeditions.vrac.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    if (isBusinessLogicErrorLike(error)) {
      logger.warn({
        action: 'expeditions.vrac.post.business_rejected',
        requestId,
        details: { message: error.message },
      });

      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: error.message },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'expeditions.vrac.post.unhandled_error',
      requestId,
      details: serializeErrorDetails(error),
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
