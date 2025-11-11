import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    return logMessage;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let logMessage = `${timestamp} ${level} ${message}`;
          if (Object.keys(meta).length > 0) {
            logMessage += `\n${JSON.stringify(meta, null, 2)}`;
          }
          return logMessage;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'proposal-contract-agent-error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    new winston.transports.File({
      filename: 'proposal-contract-agent.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'proposal-contract-agent-exceptions.log' }),
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

export function logToolExecution(
  toolName: string,
  params: Record<string, unknown>,
  durationMs: number
): void {
  logger.info('Tool executed', {
    tool: toolName,
    durationMs,
    paramKeys: Object.keys(params),
  });
}
