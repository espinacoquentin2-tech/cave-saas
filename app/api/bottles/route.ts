import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError } from '@/lib/errors';
import { listBottleLotsQuerySchema } from '@/server/modules/bottles/bottle.schemas';
import { BottleModuleService } from '@/server/modules/bottles/bottle.service';
import { logger } from '@/server/shared/logger';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const { searchParams } = new URL(request.url);
    const payload = listBottleLotsQuerySchema.parse({ id: searchParams.get('id') ?? undefined });
    const bottles = await BottleModuleService.list(payload);

    logger.info({
      action: 'bottles.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: bottles.length },
    });

    return NextResponse.json(bottles, {
      status: 200,
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'bottles.get.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'bottles.get.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const { searchParams } = new URL(request.url);
    const payload = listBottleLotsQuerySchema.parse({ id: searchParams.get('id') ?? undefined });

    if (!payload.id) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Paramètre id requis.' },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    const result = await BottleModuleService.delete(payload.id, actor);

    logger.info({
      action: 'bottles.delete.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { bottleLotId: payload.id },
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        data: result,
      },
      {
        status: 200,
        headers: { 'x-request-id': requestId },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({
        action: 'bottles.delete.validation_failed',
        requestId,
        details: { issues: error.flatten() },
      });

      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    if (error instanceof BusinessLogicError) {
      logger.warn({
        action: 'bottles.delete.business_rejected',
        requestId,
        details: { message: error.message },
      });

      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: error.message },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'bottles.delete.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });

    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}