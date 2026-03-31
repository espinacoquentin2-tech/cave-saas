import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { createWorkOrderSchema } from '@/server/modules/workorders/workorder.schemas';
import { WorkOrderModuleService } from '@/server/modules/workorders/workorder.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = createWorkOrderSchema.parse(await request.json());
    const result = await WorkOrderModuleService.create(payload, actor);

    logger.info({
      action: 'workorders.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: {
        workOrderId: result.workOrder.id,
        recette: result.workOrder.recette,
      },
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        data: result.workOrder,
      },
      {
        status: 201,
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'workorders.post.validation_failed',
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
        action: 'workorders.post.business_rejected',
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
      action: 'workorders.post.unhandled_error',
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
