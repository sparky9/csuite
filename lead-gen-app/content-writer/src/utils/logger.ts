/**
 * Logger utility using Winston
 * Provides structured logging for Content Writer MCP
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }

    return logMessage;
  })
);

/**
 * Winston logger instance
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let logMessage = `${timestamp} ${level} ${message}`;

          // Add metadata in readable format for console
          if (Object.keys(meta).length > 0) {
            const metaStr = JSON.stringify(meta, null, 2);
            logMessage += `\n${metaStr}`;
          }

          return logMessage;
        })
      ),
    }),

    // Error log file
    new winston.transports.File({
      filename: 'content-writer-error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),

    // Combined log file
    new winston.transports.File({
      filename: 'content-writer.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'content-writer-exceptions.log' }),
  ],
});

/**
 * Log startup information
 */
export function logStartup(serverName: string, version: string, tools: string[]): void {
  logger.info('MCP Server starting', {
    server: serverName,
    version,
    tools,
    logLevel,
    environment: process.env.NODE_ENV || 'development',
  });
}

/**
 * Log tool execution
 */
export function logToolExecution(
  toolName: string,
  userId: string | undefined,
  params: Record<string, any>,
  success: boolean,
  durationMs?: number
): void {
  logger.info('Tool executed', {
    tool: toolName,
    userId: userId || 'anonymous',
    success,
    durationMs,
    paramKeys: Object.keys(params),
  });
}

/**
 * Log API call
 */
export function logApiCall(
  endpoint: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number
): void {
  logger.debug('API call completed', {
    endpoint,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    durationMs,
  });
}

export default logger;
