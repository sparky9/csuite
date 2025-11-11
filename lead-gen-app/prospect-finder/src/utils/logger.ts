/**
 * Structured logging with Winston
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'prospect-finder-mcp' },
  transports: [
    // Console output for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length > 0) {
            // Remove service from meta since it's always the same
            const { service, ...restMeta } = meta;
            if (Object.keys(restMeta).length > 0) {
              metaStr = ' ' + JSON.stringify(restMeta);
            }
          }
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// Create logs directory if it doesn't exist (will add file transport later if needed)
// For now, console logging is sufficient for development

export default logger;
