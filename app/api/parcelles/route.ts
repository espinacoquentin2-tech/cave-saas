import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { DELETE_ROLES, READ_ROLES, WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';
=======
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';
>>>>>>> main

const createParcelleSchema = z.object({
  nom: z.string().trim().min(1),
  departement: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  commune: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
<<<<<<< HEAD
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, READ_ROLES);
=======
    const actor = parseRequestActor(request);
>>>>>>> main
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
<<<<<<< HEAD
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

=======
>>>>>>> main
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
<<<<<<< HEAD
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
=======
    const actor = parseRequestActor(request);
>>>>>>> main
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
<<<<<<< HEAD
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

=======
>>>>>>> main
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
