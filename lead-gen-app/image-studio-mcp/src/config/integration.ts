/**
 * Integration configuration utilities for downstream VPA modules.
 */

import type {
  StageIntegrationOverrides,
  BookkeepingIntegrationOptions,
  TaskManagerIntegrationOptions,
} from '../types/index.js';

const truthy = new Set(['true', '1', 'yes', 'y', 'on']);

const parseBoolean = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return truthy.has(normalized);
};

const getString = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export interface BookkeepingIntegrationEnv extends BookkeepingIntegrationOptions {
  enabled: boolean;
}

export interface TaskManagerIntegrationEnv extends TaskManagerIntegrationOptions {
  enabled: boolean;
}

export interface IntegrationEnvironment {
  bookkeeping: BookkeepingIntegrationEnv;
  taskManager: TaskManagerIntegrationEnv;
}

export interface ResolvedBookkeepingConfig extends BookkeepingIntegrationOptions {
  enabled: boolean;
}

export interface ResolvedTaskManagerConfig extends TaskManagerIntegrationOptions {
  enabled: boolean;
}

export interface ResolvedIntegrationSettings {
  bookkeeping: ResolvedBookkeepingConfig;
  taskManager: ResolvedTaskManagerConfig;
}

let cachedEnvironment: IntegrationEnvironment | null = null;

export function getIntegrationEnvironment(): IntegrationEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const sharedUserId = getString(process.env.IMAGE_STUDIO_VPA_USER_ID);
  const sharedBrand = getString(process.env.IMAGE_STUDIO_DEFAULT_BRAND);

  cachedEnvironment = {
    bookkeeping: {
      enabled: parseBoolean(process.env.IMAGE_STUDIO_BOOKKEEPING_ENABLED),
      userId:
        getString(process.env.IMAGE_STUDIO_BOOKKEEPING_USER_ID) ??
        sharedUserId,
      category: getString(process.env.IMAGE_STUDIO_BOOKKEEPING_CATEGORY),
      notes: getString(process.env.IMAGE_STUDIO_BOOKKEEPING_NOTES),
      currency: getString(process.env.IMAGE_STUDIO_BOOKKEEPING_CURRENCY),
      description: getString(process.env.IMAGE_STUDIO_BOOKKEEPING_DESCRIPTION),
      brand: getString(process.env.IMAGE_STUDIO_BOOKKEEPING_BRAND) ?? sharedBrand,
      databaseUrl:
        getString(process.env.IMAGE_STUDIO_BOOKKEEPING_DATABASE_URL) ??
        getString(process.env.BOOKKEEPING_DATABASE_URL) ??
        getString(process.env.DATABASE_URL),
    },
    taskManager: {
      enabled: parseBoolean(process.env.IMAGE_STUDIO_TASK_MANAGER_ENABLED),
      userId:
        getString(process.env.IMAGE_STUDIO_TASK_MANAGER_USER_ID) ??
        sharedUserId,
      projectId: getString(process.env.IMAGE_STUDIO_TASK_MANAGER_PROJECT_ID),
      label: getString(process.env.IMAGE_STUDIO_TASK_MANAGER_LABEL),
      description: getString(process.env.IMAGE_STUDIO_TASK_MANAGER_DESCRIPTION),
      brand: getString(process.env.IMAGE_STUDIO_TASK_MANAGER_BRAND) ?? sharedBrand,
      databaseUrl:
        getString(process.env.IMAGE_STUDIO_TASK_MANAGER_DATABASE_URL) ??
        getString(process.env.TASK_MANAGER_DATABASE_URL) ??
        getString(process.env.DATABASE_URL),
    },
  } satisfies IntegrationEnvironment;

  return cachedEnvironment;
}

const mergeBookkeeping = (
  base: BookkeepingIntegrationEnv,
  override?: BookkeepingIntegrationOptions,
): ResolvedBookkeepingConfig => ({
  enabled: typeof override?.enabled === 'boolean' ? override.enabled : base.enabled,
  userId: override?.userId ?? base.userId,
  category: override?.category ?? base.category,
  notes: override?.notes ?? base.notes,
  currency: override?.currency ?? base.currency,
  description: override?.description ?? base.description,
  brand: override?.brand ?? base.brand,
  databaseUrl: override?.databaseUrl ?? base.databaseUrl,
});

const mergeTaskManager = (
  base: TaskManagerIntegrationEnv,
  override?: TaskManagerIntegrationOptions,
): ResolvedTaskManagerConfig => ({
  enabled: typeof override?.enabled === 'boolean' ? override.enabled : base.enabled,
  userId: override?.userId ?? base.userId,
  projectId: override?.projectId ?? base.projectId,
  label: override?.label ?? base.label,
  description: override?.description ?? base.description,
  brand: override?.brand ?? base.brand,
  databaseUrl: override?.databaseUrl ?? base.databaseUrl,
});

export function resolveIntegrationSettings(
  overrides?: StageIntegrationOverrides,
): ResolvedIntegrationSettings {
  const env = getIntegrationEnvironment();
  return {
    bookkeeping: mergeBookkeeping(env.bookkeeping, overrides?.bookkeeping),
    taskManager: mergeTaskManager(env.taskManager, overrides?.taskManager),
  };
}
