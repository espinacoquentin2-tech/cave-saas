import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

const createParcelleSchema = z.object({
  nom: z.string().trim().min(1),
  departement: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  commune: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const parcelles = await prisma.parcelle.findMany({ orderBy: { nom: 'asc' } });

    logger.info({
      action: 'parcelles.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { count: parcelles.length },
    });

    return NextResponse.json(parcelles, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ action: 'parcelles.get.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'parcelles.get.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const payload = createParcelleSchema.parse(await request.json());
    const parcelle = await prisma.parcelle.create({ data: payload });

    logger.info({
      action: 'parcelles.post.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { parcelleId: parcelle.id, nom: parcelle.nom },
    });

    return NextResponse.json(parcelle, { status: 201, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ action: 'parcelles.post.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    logger.error({
      action: 'parcelles.post.unhandled_error',
      requestId,
      details: { error: error instanceof Error ? error.message : 'unknown_error' },
    });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
