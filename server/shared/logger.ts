import { Prisma } from '@prisma/client';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  action: string;
  requestId?: string;
  userEmail?: string;
  role?: string;
  details?: Record<string, unknown>;
}

export interface SerializedErrorDetails extends Record<string, unknown> {
  errorName: string;
  errorMessage: string;
  stack?: string;
  prismaCode?: string;
  prismaMeta?: Record<string, unknown>;
}

const writeLog = (level: LogLevel, context: LogContext) => {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  writer(JSON.stringify(payload));
};

export const logger = {
  info: (context: LogContext) => writeLog('info', context),
  warn: (context: LogContext) => writeLog('warn', context),
  error: (context: LogContext) => writeLog('error', context),
};

export const serializeErrorDetails = (error: unknown): SerializedErrorDetails => {
  const base: SerializedErrorDetails = {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'unknown_error',
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  };

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      ...base,
      prismaCode: error.code,
      ...(error.meta ? { prismaMeta: error.meta as Record<string, unknown> } : {}),
    };
  }

  return base;
};

export const logApiError = ({
  action,
  route,
  requestId,
  actor,
  error,
  details,
}: {
  action: string;
  route: string;
  requestId?: string;
  actor?: { email?: string | null; role?: string | null } | null;
  error: unknown;
  details?: Record<string, unknown>;
}) => {
  logger.error({
    action,
    requestId,
    userEmail: actor?.email ?? undefined,
    role: actor?.role ?? undefined,
    details: {
      route,
      ...serializeErrorDetails(error),
      ...(details ?? {}),
    },
  });
};
