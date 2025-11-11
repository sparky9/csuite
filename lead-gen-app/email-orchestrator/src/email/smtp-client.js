/**
 * SMTP integration for sending emails
 * Uses Nodemailer transport defined via environment configuration
 */
import nodemailer from 'nodemailer';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
export class SmtpClient {
    constructor() {
        this.transporter = null;
        this.initialized = false;
    }
    /**
     * Initialize SMTP transporter from environment variables
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        const host = process.env.SMTP_HOST;
        if (!host) {
            throw new Error('SMTP_HOST environment variable not set');
        }
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
    const secureEnv = process.env.SMTP_SECURE?.toLowerCase();
    const secure = secureEnv === 'true' ? true : secureEnv === 'false' ? false : port === 465;
    const resolvedPort = port ?? (secure ? 465 : 587);
        const authUser = process.env.SMTP_USERNAME;
        const authPass = process.env.SMTP_PASSWORD;
        const transporter = nodemailer.createTransport({
            host,
            port: resolvedPort,
            secure,
            auth: authUser && authPass ? { user: authUser, pass: authPass } : undefined,
            tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED?.toLowerCase() === 'false'
                ? { rejectUnauthorized: false }
                : undefined,
        });
        try {
            await transporter.verify();
            this.transporter = transporter;
            this.initialized = true;
            logger.info('SMTP client initialized', {
                host,
                secure,
            });
        }
        catch (error) {
            logger.error('Failed to initialize SMTP client', { error });
            throw error;
        }
    }
    async ensureTransporter() {
        if (!this.initialized || !this.transporter) {
            await this.initialize();
        }
        if (!this.transporter) {
            throw new Error('SMTP transporter not available');
        }
        return this.transporter;
    }
    /**
     * Send an email using SMTP
     */
    async sendEmail(params) {
        const transporter = await this.ensureTransporter();
        try {
            const info = await transporter.sendMail({
                from: params.from,
                to: params.to,
                subject: params.subject,
                html: params.html,
                text: params.text,
                headers: params.headers,
            });
            logger.info('Email sent via SMTP', {
                message_id: info.messageId,
                to: params.to,
                subject: params.subject,
            });
            return { messageId: info.messageId ?? info.response };
        }
        catch (error) {
            logger.error('Failed to send email via SMTP', {
                error: error.message,
                to: params.to,
            });
            throw new Error(`SMTP send failed: ${error.message}`);
        }
    }
    /**
     * Check SMTP sending quota based on stored configuration
     */
    async getQuotaStatus() {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
            const limits = await db.query(`SELECT key, value FROM email_config
         WHERE key IN ('smtp_daily_limit', 'smtp_hourly_limit')`);
            const limitConfig = limits.rows.reduce((acc, row) => {
                acc[row.key] = parseInt(row.value, 10);
                return acc;
            }, {});
            const envDaily = process.env.SMTP_DAILY_LIMIT ? parseInt(process.env.SMTP_DAILY_LIMIT, 10) : NaN;
            const envHourly = process.env.SMTP_HOURLY_LIMIT ? parseInt(process.env.SMTP_HOURLY_LIMIT, 10) : NaN;
            const dailyLimit = Number.isFinite(envDaily)
                ? envDaily
                : limitConfig.smtp_daily_limit || 1000;
            const hourlyLimit = Number.isFinite(envHourly)
                ? envHourly
                : limitConfig.smtp_hourly_limit || 200;
            const dailyCount = await db.queryOne(`SELECT COUNT(*) as count FROM sent_emails
         WHERE sent_at >= $1 AND provider = 'smtp'`, [todayStart]);
            const hourlyCount = await db.queryOne(`SELECT COUNT(*) as count FROM sent_emails
         WHERE sent_at >= $1 AND provider = 'smtp'`, [hourStart]);
            const dailySent = parseInt(dailyCount?.count || '0', 10);
            const hourlySent = parseInt(hourlyCount?.count || '0', 10);
            const canSend = dailySent < dailyLimit && hourlySent < hourlyLimit;
            let waitUntil;
            if (!canSend) {
                if (hourlySent >= hourlyLimit) {
                    waitUntil = new Date(hourStart);
                    waitUntil.setHours(waitUntil.getHours() + 1);
                }
                else if (dailySent >= dailyLimit) {
                    waitUntil = new Date(todayStart);
                    waitUntil.setDate(waitUntil.getDate() + 1);
                }
            }
            return {
                daily_sent: dailySent,
                daily_limit: dailyLimit,
                hourly_sent: hourlySent,
                hourly_limit: hourlyLimit,
                can_send: canSend,
                wait_until: waitUntil,
            };
        }
        catch (error) {
            logger.error('Failed to check SMTP quota', { error });
            throw error;
        }
    }
}
export const smtpClient = new SmtpClient();
//# sourceMappingURL=smtp-client.js.map
