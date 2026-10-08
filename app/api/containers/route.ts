import { NextResponse } from 'next/server';
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import { logger, logApiError } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

const createContainerSchema = z.object({
  code: z.string().trim().optional(),
  name: z.string().trim().optional(),
  displayName: z.string().trim().optional(),
  type: z.string().trim().optional(),
  capacityValue: z.coerce.number().positive().optional(),
  capacity: z.coerce.number().nonnegative().optional(),
  zone: z.string().trim().optional(),
  status: z.string().trim().optional(),
  notes: z.string().optional(),
});

const updateContainerSchema = z.object({
  usage: z.enum(["MR", "PCM"]).nullable().optional(),
  idempotencyKey: z.string().uuid().optional(),
  id: z.coerce.number().int().positive(),
  status: z.string().trim().optional(),
  name: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const route = '/api/containers';
  let actor: Awaited<ReturnType<typeof resolveAuthenticatedActor>> | null = null;

  try {
    actor = await resolveAuthenticatedActor(request);
    assertRole(actor, READ_ROLES);
    const containers = await prisma.container.findMany({
      where: { organizationId: actor.organizationId, status: { not: 'ARCHIVÉE' } },
      include: { currentLots: true },
    });

    logger.info({
      action: 'containers.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { route, count: containers.length },
    });

    return NextResponse.json(containers, { status: 200, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: 'containers.get.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logApiError({
      action: 'containers.get.unhandled_error',
      route,
      requestId,
      actor,
      error,
    });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = createContainerSchema.parse(await request.json());
    const normalizedName = payload.name?.trim() || payload.displayName?.trim() || 'Nouvelle Cuve';
    const normalizedCode = payload.code?.trim() || `${normalizedName.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const container = await prisma.container.create({
      data: {
        code: normalizedCode,
        organizationId: actor.organizationId,
        displayName: normalizedName,
        type: payload.type ?? 'Cuve',
        capacityValue: payload.capacityValue ?? payload.capacity ?? 0,
        capacityUnit: 'hL',
        zone: payload.zone ?? 'Cuverie',
        status: payload.status ?? 'VIDE',
        notes: payload.notes ?? '',
      },
    });

    logger.info({
      action: 'containers.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { containerId: container.id },
    });

    return NextResponse.json(container, { status: 201, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: 'containers.post.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.warn({
        action: 'containers.post.duplicate_conflict',
        requestId,
        details: { message: error.message },
      });
      return NextResponse.json(
        { error: 'BUSINESS_RULE_VIOLATION', message: 'Un contenant avec ce code existe déjà.' },
        { status: 409, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({ action: 'containers.post.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = updateContainerSchema.parse(await request.json());

    if (payload.usage !== undefined && !payload.idempotencyKey) throw new BusinessLogicError("Clé de modification d’usage requise.");
    await prisma.$transaction(async tx => {
      if (payload.usage !== undefined) {
        const previous = await tx.idempotencyRecord.findUnique({ where: { key: payload.idempotencyKey! } });
        if (previous) {
          const event = await tx.lotEvent.findFirst({ where: { organizationId: actor.organizationId, eventType: 'CHANGEMENT_USAGE_CONTENANT', metadata: { path: ['idempotencyKey'], equals: payload.idempotencyKey } } });
          if (event && (event.metadata as Prisma.JsonObject)?.containerId === payload.id && (event.metadata as Prisma.JsonObject)?.usage === payload.usage && previous.userId === `${actor.organizationId}:${actor.userId}`) return;
          throw new BusinessLogicError('Clé déjà utilisée pour une autre opération.', 409);
        }
        await tx.idempotencyRecord.create({ data: { key: payload.idempotencyKey!, action: 'CHANGEMENT_USAGE_CONTENANT', userId: `${actor.organizationId}:${actor.userId}` } });
      }
      const container = await tx.container.findFirst({ where: { id: payload.id, organizationId: actor.organizationId }, include: { currentLots: { where: { currentVolume: { gt: 0 } } } } });
      if (!container) throw new BusinessLogicError('Contenant introuvable.', 404);
      const usageChanged = payload.usage !== undefined && payload.usage !== container.usage;
      if ((usageChanged || (container.usage && payload.status && payload.status !== container.status)) && container.currentLots.length)
        throw new BusinessLogicError('Le contenant doit être vide avant de changer son usage ou son statut Malo.', 409);
      await tx.container.update({ where: { id: container.id }, data: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.name ? { displayName: payload.name } : {}),
        ...(payload.usage !== undefined ? { usage: payload.usage } : {}),
      } });
      if (payload.usage !== undefined) await tx.lotEvent.create({ data: { organizationId: actor.organizationId, operatorUserId: actor.userId, eventType: 'CHANGEMENT_USAGE_CONTENANT', eventDatetime: new Date(), metadata: { containerId: container.id, previousUsage: container.usage, usage: payload.usage, idempotencyKey: payload.idempotencyKey } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    logger.info({
      action: 'containers.put.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { containerId: payload.id },
    });

    return NextResponse.json({ success: true }, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof BusinessLogicError) return NextResponse.json({ error: 'BUSINESS_RULE_VIOLATION', message: error.message }, { status: error.statusCode, headers: { 'x-request-id': requestId } });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return NextResponse.json({ error: 'CONFLICT', message: 'Le contenant a changé. Actualisez les données.' }, { status: 409 });

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
      logger.warn({ action: 'containers.put.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.put.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);
  const message =
    'La suppression physique d’un contenant est désactivée pour préserver la traçabilité. Utilise une future opération d’archivage contrôlée.';

  logger.warn({
    action: 'containers.delete.disabled',
    requestId,
    details: { message },
  });

  return NextResponse.json(
    {
      error: 'METHOD_NOT_ALLOWED',
      message,
    },
    {
      status: 405,
      headers: {
        Allow: 'GET, POST, PUT',
        'x-request-id': requestId,
      },
    },
  );
}
