import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { TraceabilityRequestSchema } from '../../../validations/tracabilite.schema';
import { TracabiliteService } from '../../../services/tracabilite.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = TraceabilityRequestSchema.parse(await request.json());
    const lineage = await TracabiliteService.getLineage(payload);

    logger.info({
      action: 'tracabilite.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { sourceType: payload.sourceType, sourceId: payload.sourceId },
    });

    return NextResponse.json(lineage, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
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
