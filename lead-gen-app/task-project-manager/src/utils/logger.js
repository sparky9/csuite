import winston from 'winston';
const level = process.env.LOG_LEVEL || 'info';
const logger = winston.createLogger({
    level,
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.printf(({ level: lvl, message, timestamp, ...meta }) => {
                const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${lvl}] ${message}${extra}`;
            })),
        }),
    ],
});
export class Logger {
    static info(message, meta) {
        logger.info(message, meta);
    }
    static debug(message, meta) {
        if (logger.isLevelEnabled('debug')) {
            logger.debug(message, meta);
        }
    }
    static warn(message, meta) {
        logger.warn(message, meta);
    }
    static error(message, meta) {
        logger.error(message, meta);
    }
}
