import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

const createCompartmentSchema = z.object({
  originalContainerId: z.coerce.number().int().positive(),
  newCapacity: z.coerce.number().positive(),
});

const deleteCompartmentQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = createCompartmentSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const parentContainer = await tx.container.findUnique({
        where: { id: payload.originalContainerId },
        include: { children: true },
      });

      if (!parentContainer) {
        throw new Error('Citerne introuvable');
      }

      const newCompNumber = parentContainer.children.length + 2;
      const baseName = parentContainer.displayName.replace(/ - Comp \d+$/, '');

      return tx.container.create({
        data: {
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
    if (error instanceof ZodError) {
      logger.warn({ action: 'containers.compartment.post.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'containers.compartment.post.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
