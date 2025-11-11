/**
 * Winston Logger Configuration
 *
 * Centralized logging for the Research Insights module.
 */

import winston from 'winston';

const env = (globalThis as any)?.process?.env ?? {};
const logLevel = env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }: Record<string, unknown>) => {
    const lvl = typeof level === 'string' ? level : 'info';
    const time = typeof timestamp === 'string' ? timestamp : new Date().toISOString();
    const msgText = typeof message === 'string' ? message : String(message);
    let msg = `${time} [${lvl}]: ${msgText}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'research-insights' },
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'production' ? logFormat : consoleFormat
    })
  ]
});

if (env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/research-insights-error.log',
      level: 'error'
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/research-insights.log'
    })
  );
}

export function logError(message: string, error: Error | unknown, context?: Record<string, any>) {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  });
}
