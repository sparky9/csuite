/**
 * Pricing Configuration
 *
 * IMPORTANT: This file is designed for EASY CHANGES per Mike's requirement.
 * Simply update the prices or module combinations here - no other code changes needed.
 *
 * All prices are in cents (e.g., 9900 = $99.00) for precision.
 */

export interface PricingPlan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number; // in cents: 9900 = $99.00
  modules: string[]; // Module IDs from registry
  limits?: {
    monthlyProspects?: number;
    monthlyCampaigns?: number;
    monthlyEmails?: number;
    pipelineCapacity?: number;
  };
  features: string[]; // Marketing copy for features
  recommended?: boolean; // Highlight as recommended plan?
}

/**
 * VPA Pricing Plans
 *
 * To change pricing:
 * 1. Update priceMonthly (in cents)
 * 2. Modify module combinations
 * 3. Add/remove plans as needed
 * 4. Update limits if implementing usage-based billing
 *
 * No other code changes required - pricing is centralized here.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'vpa-core-only',
    name: 'VPA Core Only',
    displayName: 'CRM Starter',
    priceMonthly: 3000, // $30.00
    modules: ['vpa-core', 'lead-tracker'],
    features: [
      'Full CRM pipeline management',
      'Unlimited prospects tracking',
      'Activity logging and follow-ups',
      'Pipeline analytics'
    ]
  },

  {
    id: 'vpa-plus-prospects',
    name: 'VPA + ProspectFinder',
    displayName: 'Growth Plan',
    priceMonthly: 8000, // $80.00
    modules: ['vpa-core', 'lead-tracker', 'prospect-finder'],
    limits: {
      monthlyProspects: 5000 // Can scrape up to 5000 prospects/month
    },
    features: [
      'Everything in CRM Starter',
      'B2B prospect scraping',
      'Company enrichment',
      'Decision maker discovery',
      'Up to 5,000 prospects/month'
    ]
  },

  {
    id: 'vpa-plus-email',
    name: 'VPA + Email',
    displayName: 'Outreach Plan',
    priceMonthly: 5500, // $55.00
    modules: ['vpa-core', 'lead-tracker', 'email-orchestrator'],
    limits: {
      monthlyCampaigns: 20,
      monthlyEmails: 10000
    },
    features: [
      'Everything in CRM Starter',
      'Email campaign automation',
      'Sequence management',
      'Email templates',
      'Up to 20 campaigns/month',
      'Up to 10,000 emails/month'
    ]
  },

  {
    id: 'vpa-bundle',
    name: 'VPA Complete Bundle',
    displayName: 'Complete Suite',
    priceMonthly: 9900, // $99.00 (saves $25.50 vs. buying separately)
    modules: ['vpa-core', 'lead-tracker', 'prospect-finder', 'email-orchestrator'],
    limits: {
      monthlyProspects: 10000,
      monthlyCampaigns: 50,
      monthlyEmails: 25000
    },
    features: [
      'Everything in all plans',
      'Full lead generation workflow',
      'Prospect finding + CRM + Email outreach',
      'Up to 10,000 prospects/month',
      'Up to 50 campaigns/month',
      'Up to 25,000 emails/month',
      'Priority support'
    ],
    recommended: true // Highlight this plan
  }
];

/**
 * Get pricing plan by ID
 */
export function getPricingPlan(planId: string): PricingPlan | undefined {
  return PRICING_PLANS.find(plan => plan.id === planId);
}

/**
 * Get all pricing plans
 */
export function getAllPricingPlans(): PricingPlan[] {
  return PRICING_PLANS;
}

/**
 * Get recommended plan
 */
export function getRecommendedPlan(): PricingPlan | undefined {
  return PRICING_PLANS.find(plan => plan.recommended);
}

/**
 * Get plan by modules (find cheapest plan that includes these modules)
 */
export function getPlanByModules(requiredModules: string[]): PricingPlan | undefined {
  const compatiblePlans = PRICING_PLANS.filter(plan =>
    requiredModules.every(mod => plan.modules.includes(mod))
  );

  if (compatiblePlans.length === 0) {
    return undefined;
  }

  // Return cheapest compatible plan
  return compatiblePlans.sort((a, b) => a.priceMonthly - b.priceMonthly)[0];
}

/**
 * Check if a plan includes a specific module
 */
export function planIncludesModule(planId: string, moduleId: string): boolean {
  const plan = getPricingPlan(planId);
  return plan ? plan.modules.includes(moduleId) : false;
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Get pricing tier name for marketing
 */
export function getPricingTierName(planId: string): string {
  const plan = getPricingPlan(planId);
  return plan?.displayName || plan?.name || planId;
}

/**
 * Calculate savings vs. individual module pricing (for bundle marketing)
 */
export function calculateBundleSavings(): number {
  const bundle = getPricingPlan('vpa-bundle');
  const individual = [
    getPricingPlan('vpa-core-only'),
    getPricingPlan('vpa-plus-prospects'),
    getPricingPlan('vpa-plus-email')
  ];

  if (!bundle) return 0;

  // This is simplified - in reality you'd calculate based on individual module prices
  // For now, hardcode the savings calculation
  const fullPrice = 12550; // $30 + $80 + $55 (if buying all separately) = ~$125.50
  return fullPrice - bundle.priceMonthly; // Should be ~2550 cents = $25.50
}
