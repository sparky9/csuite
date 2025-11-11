import { getSubscriptionInfo } from '../auth/license.js';
import { getEnabledModules } from '../auth/module-access.js';
import {
  MODULE_REGISTRY,
  type ModuleDefinition,
  type ModuleQuickAction
} from './registry.js';

export interface ModuleCatalogQuickAction extends ModuleQuickAction {
  locked: boolean;
}

export interface ModuleCatalogEntry {
  id: string;
  name: string;
  icon: string;
  category: string;
  tagline: string;
  description: string;
  pricingTier: ModuleDefinition['pricingTier'];
  required: boolean;
  enabled: boolean;
  valueProps: string[];
  quickActions: ModuleCatalogQuickAction[];
}

export interface ModuleCatalog {
  planName: string;
  enabledCount: number;
  lockedCount: number;
  modules: ModuleCatalogEntry[];
}

export async function buildModuleCatalog(userId: string): Promise<ModuleCatalog> {
  const [subscription, enabledModules] = await Promise.all([
    getSubscriptionInfo(userId).catch(() => null),
    getEnabledModules(userId)
  ]);

  const modules: ModuleCatalogEntry[] = Object.values(MODULE_REGISTRY).map((module) => {
    const enabled = enabledModules.includes(module.id);
    const quickActions: ModuleCatalogQuickAction[] = (module.quickActions || []).map((action) => ({
      ...action,
      locked: !enabled
    }));

    return {
      id: module.id,
      name: module.name,
      icon: module.icon,
      category: module.category,
      tagline: module.tagline,
      description: module.description,
      pricingTier: module.pricingTier,
      required: module.required,
      enabled,
      valueProps: module.valueProps,
      quickActions
    };
  });

  const enabledCount = modules.filter((module) => module.enabled).length;
  const lockedCount = modules.length - enabledCount;

  return {
    planName: subscription?.planName ?? 'Unknown plan',
    enabledCount,
    lockedCount,
    modules
  };
}
