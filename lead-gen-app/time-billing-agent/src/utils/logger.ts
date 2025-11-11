import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';

function serializeUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'time-billing-agent' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf((info: unknown) => {
          if (!isRecord(info)) {
            return serializeUnknown(info);
          }

          const timestampValue = info.timestamp;
          const ts = typeof timestampValue === 'string' ? timestampValue : new Date().toISOString();
          const levelValue = typeof info.level === 'string' ? info.level : 'info';
          const msg = serializeUnknown(info.message);
          const meta = Object.entries(info)
            .filter(([key]) => !['timestamp', 'level', 'message'].includes(key))
            .reduce<Record<string, unknown>>((acc, [key, value]) => {
              acc[key] = value;
              return acc;
            }, {});
          const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${ts} [${levelValue}]: ${msg}${rest}`;
        })
      )
    })
  ]
});

export function logToolExecution(tool: string, metadata: Record<string, unknown>): void {
  logger.info('Tool execution', { tool, ...metadata });
}
