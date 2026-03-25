import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { saveDegustationSchema } from '@/server/modules/degustations/degustation.schemas';
import { DegustationModuleService } from '@/server/modules/degustations/degustation.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const records = await DegustationModuleService.list();

    logger.info({
      action: 'degustations.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: records.length },
    });

    return NextResponse.json(records, {
      status: 200,
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'degustations.get.validation_failed',
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

    logger.error({
      action: 'degustations.get.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
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

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = saveDegustationSchema.parse(await request.json());
    const result = await DegustationModuleService.save(payload, actor);

    logger.info({
      action: 'degustations.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { recordId: result.record.id, phase: result.record.phase },
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        data: result.record,
      },
      {
        status: 201,
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'degustations.post.validation_failed',
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
        action: 'degustations.post.business_rejected',
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
      action: 'degustations.post.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
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
