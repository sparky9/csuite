/**
 * Winston logger configured for the Support Agent package.
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
  defaultMeta: { service: 'support-agent' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
          const metaEntries = Object.entries(meta).filter(([key]) => key !== 'service');
          const metaString = metaEntries.length ? ` ${JSON.stringify(Object.fromEntries(metaEntries))}` : '';
          const time = typeof timestamp === 'string' ? timestamp : new Date().toISOString();
          const text = typeof message === 'string' ? message : String(message);
          return `${time} [${String(level)}]: ${text}${metaString}`;
        })
      ),
    }),
  ],
});

export default logger;
