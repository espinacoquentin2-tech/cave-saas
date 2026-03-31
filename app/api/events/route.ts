import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { logger } from '@/server/shared/logger';
import { prisma } from '@/server/shared/prisma';
import { getRequestId, parseRequestActor } from '@/server/shared/request-context';

export const dynamic = 'force-dynamic';

const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const actor = parseRequestActor(request);
    const { searchParams } = new URL(request.url);
    const payload = listEventsQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      year: searchParams.get('year') ?? undefined,
    });

    const skip = (payload.page - 1) * payload.limit;
    const whereClause = payload.year
      ? {
          eventDatetime: {
            gte: new Date(`${payload.year}-01-01T00:00:00.000Z`),
            lte: new Date(`${payload.year}-12-31T23:59:59.999Z`),
          },
        }
      : {};

    const events = await prisma.lotEvent.findMany({
      where: whereClause,
      include: { lots: true, containers: true },
      orderBy: { eventDatetime: 'desc' },
      skip,
      take: payload.limit,
    });

    const totalEvents = await prisma.lotEvent.count({ where: whereClause });
    const totalPages = Math.ceil(totalEvents / payload.limit);

    logger.info({
      action: 'events.get.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { page: payload.page, limit: payload.limit, total: totalEvents },
    });

    return NextResponse.json(
      {
        data: events,
        meta: {
          total: totalEvents,
          page: payload.page,
          totalPages,
          hasMore: payload.page < totalPages,
        },
      },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ action: 'events.get.validation_failed', requestId, details: { issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    logger.error({ action: 'events.get.unhandled_error', requestId, details: { error: error instanceof Error ? error.message : 'unknown_error' } });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
