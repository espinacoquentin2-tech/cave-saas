import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { cancelWorkOrderSchema } from '@/server/modules/workorders/workorder.schemas';
import { WorkOrderModuleService } from '@/server/modules/workorders/workorder.service';
import { logger } from '@/server/shared/logger';
import {
  DELETE_ROLES,
  assertRole,
  getRequestId,
  resolveAuthenticatedActor,
} from '@/server/shared/request-context';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, DELETE_ROLES);
    const { id } = await params;
    const payload = cancelWorkOrderSchema.parse(await request.json());
    const result = await WorkOrderModuleService.cancel(id, payload, actor);

    logger.info({
      action: 'workorders.cancel.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { workOrderId: id, reason: payload.reason },
    });

    return NextResponse.json(
      { status: 'SUCCESS', data: result.workOrder },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return NextResponse.json(
        {
          error: error instanceof UnauthorizedError ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: error.message,
        },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    if (error instanceof BusinessLogicError) {
      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: error.message },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'workorders.cancel.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
