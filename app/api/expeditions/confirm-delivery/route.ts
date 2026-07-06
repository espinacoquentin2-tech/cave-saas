import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BusinessLogicError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { confirmDeliverySchema } from '@/server/modules/expeditions/delivery-confirmation.schemas';
import { DeliveryConfirmationService } from '@/server/modules/expeditions/delivery-confirmation.service';
import { logger, logApiError } from '@/server/shared/logger';
import { WRITE_ROLES, assertRole, getRequestId, resolveAuthenticatedActor } from '@/server/shared/request-context';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const route = '/api/expeditions/confirm-delivery';
  let actor: Awaited<ReturnType<typeof resolveAuthenticatedActor>> | null = null;

  try {
    actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = confirmDeliverySchema.parse(await request.json());
    const result = await DeliveryConfirmationService.confirm(payload, actor.email, actor.organizationId);

    logger.info({
      action: 'expeditions.confirm_delivery.success',
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: { route, type: payload.type, id: payload.id },
    });

    return NextResponse.json({ status: 'SUCCESS', data: result }, { status: 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      logger.warn({ action: 'auth.rejected', requestId, details: { route, message: error.message } });
      return NextResponse.json(
        { error: error instanceof UnauthorizedError ? 'UNAUTHORIZED' : 'FORBIDDEN', message: error.message },
        { status: error.statusCode, headers: { 'x-request-id': requestId } },
      );
    }

    if (error instanceof ZodError) {
      logger.warn({ action: 'expeditions.confirm_delivery.validation_failed', requestId, details: { route, issues: error.flatten() } });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.flatten() }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    if (error instanceof BusinessLogicError) {
      logger.warn({ action: 'expeditions.confirm_delivery.business_rejected', requestId, details: { route, message: error.message } });
      return NextResponse.json({ error: 'BUSINESS_RULE_VIOLATION', message: error.message }, { status: error.statusCode, headers: { 'x-request-id': requestId } });
    }

    logApiError({
      action: 'expeditions.confirm_delivery.unhandled_error',
      route,
      requestId,
      actor,
      error,
    });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erreur serveur lors de la confirmation de livraison.' }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
