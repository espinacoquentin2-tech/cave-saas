export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  action: string;
  requestId?: string;
  userEmail?: string;
  role?: string;
  details?: Record<string, unknown>;
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
