import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

const createCompartmentSchema = z.object({
  originalContainerId: z.coerce.number().int().positive(),
  newCapacity: z.coerce.number().positive(),
});

const deleteCompartmentQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
});
const createCompartmentSchema = z.object({
  originalContainerId: z.coerce.number().int().positive(),
  newCapacity: z.coerce.number().positive(),
});

const deleteCompartmentQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = createCompartmentSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const parentContainer = await tx.container.findUnique({
        where: { id: payload.originalContainerId },
        include: { children: true },
      const parentContainer = await tx.container.findUnique({
        where: { id: payload.originalContainerId },
        include: { children: true },
      });

      if (!parentContainer) {
        throw new Error('Citerne introuvable');
      }

      if (!parentContainer) {
        throw new Error('Citerne introuvable');
      }

      const newCompNumber = parentContainer.children.length + 2;
      const baseName = parentContainer.displayName.replace(/ - Comp \d+$/, '');

      return tx.container.create({
      return tx.container.create({
        data: {
          code: `COMP-${Date.now()}-${Math.floor(Math.random() * 100)}`,
          code: `COMP-${Date.now()}-${Math.floor(Math.random() * 100)}`,
          displayName: `${baseName} - Comp ${newCompNumber}`,
          type: 'COMPARTIMENT',
          capacityValue: payload.newCapacity,
          status: 'VIDE',
          parentId: parentContainer.id,
        },
      });
    });

    logger.info({
      action: 'containers.compartment.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { containerId: result.id, parentId: result.parentId },
    });

    return NextResponse.json({ success: true, container: result }, { status: 200, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: 'containers.compartment.post.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.compartment.post.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, DELETE_ROLES);
    const { searchParams } = new URL(request.url);
    const payload = deleteCompartmentQuerySchema.parse({ id: searchParams.get('id') });

    await prisma.container.delete({ where: { id: payload.id } });

    logger.info({
      action: 'containers.compartment.delete.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { containerId: payload.id },
    });

    return NextResponse.json({ success: true }, { status: 200, headers: { 'x-request-id': requestId } });
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
      logger.warn({ action: 'containers.compartment.delete.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.compartment.delete.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

