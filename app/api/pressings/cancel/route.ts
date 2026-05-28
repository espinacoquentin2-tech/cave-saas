import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { DELETE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export const dynamic = 'force-dynamic';

const cancelPressingSchema = z.object({
  id: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1, 'La raison est obligatoire.').max(500),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, DELETE_ROLES);
    const payload = cancelPressingSchema.parse(await request.json());

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
          details: `Apport #${payload.id} annulé par ${actor.email}. Raison: ${payload.reason}.`,
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
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    if (error instanceof SyntaxError) {
      logger.warn({ action: 'pressings.cancel.invalid_json', requestId, details: { message: error.message } });
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Payload JSON invalide.' },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'pressings.cancel.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
