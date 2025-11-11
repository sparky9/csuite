/**
 * Metrics Dashboard Types
 *
 * Type definitions for the VPA metrics dashboard that consolidates
 * KPIs from all modules into a single view.
 */

/**
 * Supported timeframe options for metrics
 */
export type MetricsTimeframe = '7d' | '30d' | '90d' | '1y';

/**
 * Business metrics from Bookkeeping Assistant
 */
export interface BusinessMetrics {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number; // Percentage
}

/**
 * Pipeline metrics from LeadTracker Pro
 */
export interface PipelineMetrics {
  activeProspects: number;
  dealsWon: number;
  dealsLost: number;
  winRate: number; // Percentage
}

/**
 * Productivity metrics from Time & Billing Agent
 */
export interface ProductivityMetrics {
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number; // Percentage
}

/**
 * Reputation metrics from Reputation & Review Agent
 */
export interface ReputationMetrics {
  testimonials: number;
  publicReviews: number;
  avgRating: number;
}

/**
 * Anomaly severity levels
 */
export type AnomalySeverity = 'warning' | 'critical';

/**
 * Detected anomaly with recommendation
 */
export interface Anomaly {
  metric: string;
  change: string; // e.g., "+45%"
  severity: AnomalySeverity;
  recommendation: string;
}

/**
 * Complete metrics dashboard output
 */
export interface MetricsDashboard {
  timeframe: MetricsTimeframe;
  business: BusinessMetrics;
  pipeline: PipelineMetrics;
  productivity: ProductivityMetrics;
  reputation: ReputationMetrics;
  anomalies: Anomaly[];
}

/**
 * Input parameters for metrics dashboard
 */
export interface MetricsDashboardParams {
  userId: string;
  timeframe?: MetricsTimeframe;
}

/**
 * Internal cache entry structure
 */
export interface MetricsCacheEntry {
  data: MetricsDashboard;
  expiresAt: number;
}

/**
 * Raw metric data for anomaly comparison
 */
export interface RawMetricData {
  current: {
    revenue: number;
    expenses: number;
    activeProspects: number;
    dealsWon: number;
    dealsLost: number;
    billableHours: number;
    nonBillableHours: number;
    testimonials: number;
    publicReviews: number;
    totalRating: number;
    reviewCount: number;
  };
  previous: {
    revenue: number;
    expenses: number;
    activeProspects: number;
    dealsWon: number;
    dealsLost: number;
    billableHours: number;
    nonBillableHours: number;
    testimonials: number;
    publicReviews: number;
    totalRating: number;
    reviewCount: number;
  };
}
