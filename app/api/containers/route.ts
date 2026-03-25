import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

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

const deleteContainerQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const containers = await prisma.container.findMany({
      where: { status: { not: 'ARCHIVÉE' } },
      include: { currentLots: true },
    });

    logger.info({
      action: 'containers.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: containers.length },
    });

    return NextResponse.json(containers, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ action: 'containers.get.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.get.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = createContainerSchema.parse(await request.json());

    const container = await prisma.container.create({
      data: {
        code: payload.code ?? payload.name ?? payload.displayName ?? 'CUVE-X',
        displayName: payload.displayName ?? payload.name ?? 'Nouvelle Cuve',
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
    if (error instanceof ZodError) {
      logger.warn({ action: 'containers.post.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.post.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
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

  try {
    const actor = parseRequestActor(request);
    const { searchParams } = new URL(request.url);
    const payload = deleteContainerQuerySchema.parse({ id: searchParams.get('id') });

    try {
      await prisma.container.delete({ where: { id: payload.id } });

      logger.info({
        action: 'containers.delete.destroyed',
        requestId,
        userEmail: actor.email,
        role: actor.role,
        details: { containerId: payload.id },
      });

      return NextResponse.json({ success: true, note: 'Cuve détruite' }, { status: 200, headers: { 'x-request-id': requestId } });
    } catch (dbError) {
      const isConstraintError = dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003';
      if (!isConstraintError) {
        throw dbError;
      }

      await prisma.container.update({ where: { id: payload.id }, data: { status: 'ARCHIVÉE' } });

      logger.info({
        action: 'containers.delete.archived',
        requestId,
        userEmail: actor.email,
        role: actor.role,
        details: { containerId: payload.id },
      });

      return NextResponse.json({ success: true, note: 'Cuve archivée' }, { status: 200, headers: { 'x-request-id': requestId } });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ action: 'containers.delete.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.delete.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
