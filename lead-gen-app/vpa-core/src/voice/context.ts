/**
 * Voice Context Cache
 * 
 * Maintains short-lived conversational context so Claude Mobile and the VPA web
 * app can support quick follow-up voice commands ("reschedule that" etc.).
 */

import { logger } from '../utils/logger.js';

export type VoiceContextKey = 'lastProspect' | 'lastActivity' | 'lastSearch' | 'lastResearch';

export interface VoiceContextEntry<T = any> {
  key: VoiceContextKey;
  payload: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS: Record<VoiceContextKey, number> = {
  lastProspect: 2 * 60 * 1000,
  lastActivity: 2 * 60 * 1000,
  lastSearch: 5 * 60 * 1000,
  lastResearch: 7 * 60 * 1000,
};

const cache = new Map<string, Map<VoiceContextKey, VoiceContextEntry>>();

function getUserMap(userId: string): Map<VoiceContextKey, VoiceContextEntry> {
  let userMap = cache.get(userId);
  if (!userMap) {
    userMap = new Map();
    cache.set(userId, userMap);
  }
  return userMap;
}

export function setVoiceContext<T = any>(
  userId: string,
  key: VoiceContextKey,
  payload: T,
  ttlMs: number = DEFAULT_TTL_MS[key],
): void {
  const expiresAt = Date.now() + ttlMs;
  const entry: VoiceContextEntry<T> = { key, payload, expiresAt };
  getUserMap(userId).set(key, entry);

  logger.debug('Voice context set', { userId, key, ttlMs });
}

export function getVoiceContext<T = any>(userId: string, key: VoiceContextKey): T | undefined {
  const userMap = cache.get(userId);
  if (!userMap) {
    return undefined;
  }

  const entry = userMap.get(key);
  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    userMap.delete(key);
    logger.debug('Voice context expired', { userId, key });
    return undefined;
  }

  return entry.payload as T;
}

export function clearVoiceContext(userId: string, key?: VoiceContextKey): void {
  if (!cache.has(userId)) {
    return;
  }

  if (key) {
    cache.get(userId)!.delete(key);
    logger.debug('Voice context cleared', { userId, key });
  } else {
    cache.delete(userId);
    logger.debug('Voice context cleared for user', { userId });
  }
}

export function cleanupExpiredContext(): void {
  const now = Date.now();
  for (const [userId, userMap] of cache.entries()) {
    for (const [key, entry] of userMap.entries()) {
      if (entry.expiresAt <= now) {
        userMap.delete(key);
        logger.debug('Voice context auto-cleaned', { userId, key });
      }
    }
    if (userMap.size === 0) {
      cache.delete(userId);
    }
  }
}

export function getVoiceContextSnapshot(userId: string): Partial<Record<VoiceContextKey, unknown>> {
  const userMap = cache.get(userId);
  if (!userMap) {
    return {};
  }

  const snapshot: Partial<Record<VoiceContextKey, unknown>> = {};
  for (const [key, entry] of userMap.entries()) {
    if (Date.now() <= entry.expiresAt) {
      snapshot[key] = entry.payload;
    }
  }
  return snapshot;
}
