/**
 * Structured logging with Winston for LeadTracker Pro MCP
 */
import winston from 'winston';
const logLevel = process.env.LOG_LEVEL || 'info';
export const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json()),
    defaultMeta: { service: 'leadtracker-pro-mcp' },
    transports: [
        // Console output for development
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let metaStr = '';
                if (Object.keys(meta).length > 0) {
                    // Remove service from meta since it's always the same
                    const { service, ...restMeta } = meta;
                    if (Object.keys(restMeta).length > 0) {
                        metaStr = ' ' + JSON.stringify(restMeta);
                    }
                }
                return `${timestamp} [${level}]: ${message}${metaStr}`;
            })),
        }),
    ],
});
export default logger;
//# sourceMappingURL=logger.js.map