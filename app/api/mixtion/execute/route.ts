import { NextResponse } from 'next/server';
import { logger } from '@/server/shared/logger';
import { getRequestId } from '@/server/shared/request-context';

const legacyDisabledResponse = (request: Request) => {
  const requestId = getRequestId(request);

  logger.warn({
    action: 'mixtion.execute.disabled',
    requestId,
    details: {
      method: request.method,
      message: 'Legacy mixtion execution disabled. Modern tirage flow uses /api/tirage.',
    },
  });

  return NextResponse.json(
    {
      error: 'LEGACY_MIXTION_EXECUTE_DISABLED',
      message: 'Cette route legacy de mixtion est désactivée. Utilise /api/tirage pour créer un tirage réel.',
    },
    {
      status: 410,
      headers: { 'x-request-id': requestId },
    },
  );
};

export async function GET(request: Request) {
  return legacyDisabledResponse(request);
}

export async function POST(request: Request) {
  return legacyDisabledResponse(request);
}
