import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const format = combine(
  colorize(),
  timestamp(),
  printf((info: winston.Logform.TransformableInfo) => {
    const { level, message, timestamp: ts, ...meta } = info;
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level}: ${message}${metaString}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [new winston.transports.Console({ format })],
});

export const logToolExecution = (toolName: string, params: unknown, durationMs: number) => {
  logger.info('Tool executed', { toolName, durationMs, params });
};
