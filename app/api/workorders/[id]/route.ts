import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { WorkOrderModuleService } from '@/server/modules/workorders/workorder.service';
import { assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

const completeWorkOrderSchema = z.object({
  status: z.literal('DONE'),
  evidence: z.record(z.unknown()).optional().default({}),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, ['ADMIN', 'CHEF_CAVE', 'CAVISTE']);

    const { id } = await params;
    const payload = completeWorkOrderSchema.parse(await request.json());
    const result = await WorkOrderModuleService.complete(id, payload.evidence, actor);

    return NextResponse.json(
      {
        status: 'SUCCESS',
        data: result.workOrder,
      },
      {
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
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
