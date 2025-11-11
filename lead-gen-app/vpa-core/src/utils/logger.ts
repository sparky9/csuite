/**
 * Winston Logger Configuration
 *
 * Centralized logging for VPA Core with structured JSON logs.
 * Logs to console in development, file + console in production.
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Custom log format with timestamps and JSON structure
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format for development (more readable)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

/**
 * Winston logger instance
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'vpa-core' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
    })
  ]
});

/**
 * Add file transport in production
 */
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/vpa-error.log',
      level: 'error'
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/vpa-combined.log'
    })
  );
}

/**
 * Helper functions for common logging patterns
 */

export function logToolExecution(
  userId: string,
  tool: string,
  action: string,
  params: any,
  success: boolean,
  executionTime?: number
) {
  logger.info('Tool execution', {
    userId,
    tool,
    action,
    params,
    success,
    executionTime
  });
}

export function logError(
  message: string,
  error: Error | unknown,
  context?: Record<string, any>
) {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  });
}

export function logModuleAccess(
  userId: string,
  moduleId: string,
  granted: boolean,
  reason?: string
) {
  logger.info('Module access check', {
    userId,
    moduleId,
    granted,
    reason
  });
}

export function logLicenseValidation(
  licenseKey: string,
  valid: boolean,
  userId?: string,
  reason?: string
) {
  logger.info('License validation', {
    licenseKey: licenseKey.substring(0, 8) + '...', // Redact full key
    valid,
    userId,
    reason
  });
}

export default logger;
