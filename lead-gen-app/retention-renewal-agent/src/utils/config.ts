import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.string().default('info'),
  NOTIFICATION_SLACK_WEBHOOK: z.string().optional(),
  RETENTION_ALERT_WINDOW_DAYS: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid retention configuration: ${parsed.error.message}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}
