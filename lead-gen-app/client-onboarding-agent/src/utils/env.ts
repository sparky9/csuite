import dotenv from 'dotenv';

dotenv.config();

export const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};
