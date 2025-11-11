/**
 * Shared Winston logger for the calendar meeting agent.
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

const humanFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  let output = `${timestamp} ${level} ${message}`;
  if (Object.keys(meta).length > 0) {
    output += `\n${JSON.stringify(meta, null, 2)}`;
  }
  return output;
});

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), humanFormat),
    }),
  ],
});

export function logStartup(moduleName: string, version: string, tools: string[]): void {
  logger.info('MCP server starting', {
    module: moduleName,
    version,
    tools,
    level: logLevel,
    environment: process.env.NODE_ENV || 'development',
  });
}
