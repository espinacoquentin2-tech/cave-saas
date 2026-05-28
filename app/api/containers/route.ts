import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
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
      where: { status: { not: 'ARCHIVÉE' } },
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

    const updatedContainer = await prisma.container.update({
      where: { id: payload.id },
      data: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.name ? { displayName: payload.name } : {}),
      },
    });

    logger.info({
      action: 'containers.put.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { containerId: payload.id },
    });

    return NextResponse.json({ success: true, container: updatedContainer }, { status: 200, headers: { 'x-request-id': requestId } });
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
