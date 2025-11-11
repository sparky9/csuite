import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

const consoleFormat = winston.format.printf((info: any) => {
  const { timestamp, level, message, ...meta } = info;
  let logMessage = `${timestamp} ${level} ${message}`;
  if (Object.keys(meta).length > 0) {
    logMessage += `\n${JSON.stringify(meta, null, 2)}`;
  }
  return logMessage;
});

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), consoleFormat),
    }),
  ],
});

export function logStartup(serverName: string, version: string, tools: string[]): void {
  logger.info('MCP server starting', {
    server: serverName,
    version,
    tools,
    environment: process.env.NODE_ENV || 'development',
    logLevel,
  });
}

export function logToolExecution(toolName: string, context: Record<string, unknown>): void {
  logger.info('Tool executed', {
    tool: toolName,
    context,
  });
}
