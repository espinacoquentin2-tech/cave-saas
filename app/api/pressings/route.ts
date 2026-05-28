import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { z, ZodError } from 'zod';
import { CreateApportSchema } from '../../../validations/vendanges.schema';
import { VendangesService } from '../../../services/vendanges.service';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { DELETE_ROLES, READ_ROLES, assertRole, getRequestId, resolveAuthenticatedActor, WRITE_ROLES } from '@/server/shared/request-context';

export const dynamic = 'force-dynamic';

const deletePressingQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
});

const cancelPressingBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .optional();

const parseOptionalCancelBody = async (request: Request) => {
  const rawBody = await request.text();
  if (!rawBody.trim()) return undefined;
  return cancelPressingBodySchema.parse(JSON.parse(rawBody));
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, READ_ROLES);
    const pressings = await prisma.pressing.findMany({ orderBy: { createdAt: 'desc' } });
    const formatted = pressings.map((pressing) => ({ ...pressing, parcelle: pressing.cru, poids: pressing.weight }));

    logger.info({
      action: 'pressings.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: formatted.length },
    });

    return NextResponse.json(formatted, { status: 200, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: 'pressings.get.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'pressings.get.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = CreateApportSchema.parse(await request.json());
    const result = await VendangesService.createApport(payload);

    logger.info({
      action: 'pressings.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { pressingId: result.id },
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
      logger.warn({ action: 'pressings.post.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    const message = error instanceof Error ? error.message : 'unknown_error';
    const status = message.includes('ALREADY_APPLIED') ? 400 : 500;
    logger.error({ action: 'pressings.post.unhandled_error', requestId, details: { error: message } });
    return NextResponse.json({ error: status === 400 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_SERVER_ERROR', message }, { status, headers: { 'x-request-id': requestId } });
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, DELETE_ROLES);
    const { searchParams } = new URL(request.url);
    const payload = deletePressingQuerySchema.parse({ id: searchParams.get('id') });
    const body = await parseOptionalCancelBody(request);
    const reason = body?.reason?.trim() || 'Non renseignée';

    const existing = await prisma.pressing.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Apport introuvable.' },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }

    if (existing.status !== 'EN_ATTENTE') {
      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: 'Seul un apport en attente peut être annulé par ce flux.' },
        { status: 409, headers: { 'x-request-id': requestId } },
      );
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const updated = await tx.pressing.update({
        where: { id: payload.id },
        data: { status: 'ANNULE' },
      });

      await tx.auditLog.create({
        data: {
          action: 'PRESSING_CANCELLED',
          details: `Apport #${payload.id} annulé par ${actor.email}. Raison: ${reason}.`,
          userId: actor.email,
        },
      });

      return updated;
    });

    logger.info({
      action: 'pressings.cancel.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { pressingId: payload.id, previousStatus: existing.status },
    });

    return NextResponse.json(
      { success: true, pressing: { ...cancelled, parcelle: cancelled.cru, poids: cancelled.weight } },
      { status: 200, headers: { 'x-request-id': requestId } },
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
      logger.warn({ action: 'pressings.cancel.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    if (error instanceof SyntaxError) {
      logger.warn({ action: 'pressings.cancel.invalid_json', requestId, details: { message: error.message } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Payload JSON invalide.' }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'pressings.cancel.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
