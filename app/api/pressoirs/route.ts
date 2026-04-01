import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { ZodError } from 'zod';
import { CreatePressoirSchema, UpdatePressoirSchema } from '../../../validations/vendanges.schema';
import { VendangesService } from '../../../services/vendanges.service';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, READ_ROLES);
    const pressoirs = await prisma.pressoir.findMany({ orderBy: { nom: 'asc' } });

    logger.info({
      action: 'pressoirs.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: pressoirs.length },
    });

    return NextResponse.json(pressoirs, { status: 200, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: 'pressoirs.get.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'pressoirs.get.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

const handleMutation = async (request: Request, method: 'POST' | 'PUT') => {
  const requestId = getRequestId(request);

const handleMutation = async (request: Request, method: 'POST' | 'PUT') => {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = method === 'POST' ? CreatePressoirSchema.parse(await request.json()) : UpdatePressoirSchema.parse(await request.json());
    const result = method === 'POST' ? await VendangesService.createPressoir(payload) : await VendangesService.updatePressoir(payload);

    logger.info({
      action: `pressoirs.${method.toLowerCase()}.success`,
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { pressoirId: result.id, status: result.status },
    });

    return NextResponse.json(result, { status: 200, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: `pressoirs.${method.toLowerCase()}.validation_failed`, requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    const message = error instanceof Error ? error.message : 'unknown_error';
    const status = message.includes('ALREADY_APPLIED') ? 400 : 500;
    logger.error({ action: `pressoirs.${method.toLowerCase()}.unhandled_error`, requestId, details: { error: message } });
    return NextResponse.json({ error: status === 400 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_SERVER_ERROR', message }, { status, headers: { 'x-request-id': requestId } });
  }
};

export async function POST(request: Request) {
  return handleMutation(request, 'POST');
}

export async function PUT(request: Request) {
  return handleMutation(request, 'PUT');
}
