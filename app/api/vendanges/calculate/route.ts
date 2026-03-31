import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ProjectionsRequestSchema } from '../../../../validations/vendanges.schema';
import { VendangesService } from '../../../../services/vendanges.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = ProjectionsRequestSchema.parse(await request.json());
    const projections = await VendangesService.calculateProjections(payload);

    logger.info({
      action: 'vendanges.calculate.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { customTargetsCount: Object.keys(payload.customTargets).length },
    });

    return NextResponse.json(projections, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'vendanges.calculate.post.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'vendanges.calculate.post.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
