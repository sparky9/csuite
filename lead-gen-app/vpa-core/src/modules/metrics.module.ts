/**
 * Metrics Dashboard Module
 *
 * Consolidates KPIs from all VPA modules into a single dashboard.
 *
 * IMPLEMENTATION STATUS:
 * ✅ Pipeline metrics - IMPLEMENTED (queries LeadTracker Pro database)
 *    - Active prospects, deals won/lost, win rate
 *    - Source: prospects table
 *
 * ⏳ Business metrics - PLACEHOLDER (awaiting Bookkeeping Assistant module)
 *    - Revenue, expenses, profit, profit margin
 *    - Currently returns zeros
 *    - Will connect to: bookkeeping module's transactions table
 *
 * ⏳ Productivity metrics - PLACEHOLDER (awaiting Time & Billing Agent module)
 *    - Billable hours, non-billable hours, utilization rate
 *    - Currently returns zeros
 *    - Will connect to: time-billing module's time_entries table
 *
 * ⏳ Reputation metrics - PLACEHOLDER (awaiting Reputation & Review Agent module)
 *    - Testimonials, public reviews, average rating
 *    - Currently returns zeros
 *    - Will connect to: reputation module's testimonials and reviews tables
 *
 * Anomaly detection: Compares current vs. previous period using deterministic thresholds.
 * Caching: 5-minute TTL for performance optimization.
 */

import { db } from '../db/client.js';
import { logger, logError } from '../utils/logger.js';
import {
  getMetricsCache,
  setMetricsCache,
  clearMetricsCache
} from '../utils/metrics-cache.js';
import type {
  MetricsDashboard,
  MetricsTimeframe,
  MetricsDashboardParams,
  RawMetricData,
  Anomaly,
  BusinessMetrics,
  PipelineMetrics,
  ProductivityMetrics,
  ReputationMetrics
} from '../types/metrics.js';

/**
 * Metrics Module
 */
export class MetricsModule {
  /**
   * Get metrics dashboard for user
   */
  async getDashboard(params: MetricsDashboardParams): Promise<MetricsDashboard> {
    const { userId, timeframe = '30d' } = params;

    // Check cache first
    const cached = getMetricsCache(userId, timeframe);
    if (cached) {
      logger.info('Metrics dashboard served from cache', { userId, timeframe });
      return cached;
    }

    try {
      // Fetch raw metrics from database
      const rawData = await this.fetchRawMetrics(userId, timeframe);

      // Build dashboard
      const dashboard: MetricsDashboard = {
        timeframe,
        business: this.buildBusinessMetrics(rawData),
        pipeline: this.buildPipelineMetrics(rawData),
        productivity: this.buildProductivityMetrics(rawData),
        reputation: this.buildReputationMetrics(rawData),
        anomalies: this.detectAnomalies(rawData)
      };

      // Cache for 5 minutes
      setMetricsCache(userId, timeframe, dashboard);

      logger.info('Metrics dashboard generated', {
        userId,
        timeframe,
        anomalies: dashboard.anomalies.length
      });

      return dashboard;
    } catch (error) {
      logError('Failed to generate metrics dashboard', error, { userId, timeframe });
      throw error;
    }
  }

  /**
   * Fetch raw metrics from database
   */
  private async fetchRawMetrics(
    userId: string,
    timeframe: MetricsTimeframe
  ): Promise<RawMetricData> {
    const days = this.timeframeToDays(timeframe);
    const currentStart = new Date();
    currentStart.setDate(currentStart.getDate() - days);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    // Fetch current period metrics
    const [
      pipelineCurrent,
      // Future: businessCurrent, productivityCurrent, reputationCurrent
    ] = await Promise.all([
      this.fetchPipelineData(userId, currentStart, new Date()),
      // Placeholders for future modules
    ]);

    // Fetch previous period metrics (for anomaly detection)
    const [
      pipelinePrevious,
      // Future: businessPrevious, productivityPrevious, reputationPrevious
    ] = await Promise.all([
      this.fetchPipelineData(userId, previousStart, currentStart),
      // Placeholders for future modules
    ]);

    return {
      current: {
        // PLACEHOLDER: Bookkeeping Assistant module not yet implemented
        // TODO: Query bookkeeping DB: SELECT SUM(amount) WHERE type='income'/type='expense'
        revenue: 0,
        expenses: 0,

        // ✅ IMPLEMENTED: LeadTracker Pro
        activeProspects: pipelineCurrent.activeProspects,
        dealsWon: pipelineCurrent.dealsWon,
        dealsLost: pipelineCurrent.dealsLost,

        // PLACEHOLDER: Time & Billing Agent module not yet implemented
        // TODO: Query time-billing DB: SELECT SUM(hours) WHERE billable=true/false
        billableHours: 0,
        nonBillableHours: 0,

        // PLACEHOLDER: Reputation & Review Agent module not yet implemented
        // TODO: Query reputation DB: SELECT COUNT(*) FROM testimonials/reviews, AVG(rating)
        testimonials: 0,
        publicReviews: 0,
        totalRating: 0,
        reviewCount: 0
      },
      previous: {
        // Previous period placeholders (same modules as current)
        revenue: 0,
        expenses: 0,
        activeProspects: pipelinePrevious.activeProspects,
        dealsWon: pipelinePrevious.dealsWon,
        dealsLost: pipelinePrevious.dealsLost,
        billableHours: 0,
        nonBillableHours: 0,
        testimonials: 0,
        publicReviews: 0,
        totalRating: 0,
        reviewCount: 0
      }
    };
  }

  /**
   * Fetch pipeline data from LeadTracker Pro database
   */
  private async fetchPipelineData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    activeProspects: number;
    dealsWon: number;
    dealsLost: number;
  }> {
    try {
      // Query prospects table for pipeline metrics
      const result = await db.query(
        `SELECT
          COUNT(CASE WHEN status NOT IN ('closed_won', 'closed_lost') THEN 1 END)::int AS active_prospects,
          COUNT(CASE WHEN status = 'closed_won'
                AND updated_at >= $2 AND updated_at < $3 THEN 1 END)::int AS deals_won,
          COUNT(CASE WHEN status = 'closed_lost'
                AND updated_at >= $2 AND updated_at < $3 THEN 1 END)::int AS deals_lost
         FROM prospects
         WHERE user_id = $1`,
        [userId, startDate.toISOString(), endDate.toISOString()]
      );

      if (result.rows.length === 0) {
        return { activeProspects: 0, dealsWon: 0, dealsLost: 0 };
      }

      return {
        activeProspects: result.rows[0].active_prospects || 0,
        dealsWon: result.rows[0].deals_won || 0,
        dealsLost: result.rows[0].deals_lost || 0
      };
    } catch (error) {
      logError('Failed to fetch pipeline data', error, { userId });
      return { activeProspects: 0, dealsWon: 0, dealsLost: 0 };
    }
  }

  /**
   * Build business metrics (placeholder until Bookkeeping module exists)
   */
  private buildBusinessMetrics(rawData: RawMetricData): BusinessMetrics {
    const { revenue, expenses } = rawData.current;
    const profit = revenue - expenses;
    const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
      revenue,
      expenses,
      profit,
      profitMargin
    };
  }

  /**
   * Build pipeline metrics
   */
  private buildPipelineMetrics(rawData: RawMetricData): PipelineMetrics {
    const { activeProspects, dealsWon, dealsLost } = rawData.current;
    const totalDeals = dealsWon + dealsLost;
    const winRate = totalDeals > 0 ? Math.round((dealsWon / totalDeals) * 100) : 0;

    return {
      activeProspects,
      dealsWon,
      dealsLost,
      winRate
    };
  }

  /**
   * Build productivity metrics (placeholder until Time & Billing module exists)
   */
  private buildProductivityMetrics(rawData: RawMetricData): ProductivityMetrics {
    const { billableHours, nonBillableHours } = rawData.current;
    const totalHours = billableHours + nonBillableHours;
    const utilizationRate =
      totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    return {
      billableHours,
      nonBillableHours,
      utilizationRate
    };
  }

  /**
   * Build reputation metrics (placeholder until Reputation module exists)
   */
  private buildReputationMetrics(rawData: RawMetricData): ReputationMetrics {
    const { testimonials, publicReviews, totalRating, reviewCount } = rawData.current;
    const avgRating = reviewCount > 0 ? Math.round((totalRating / reviewCount) * 10) / 10 : 0;

    return {
      testimonials,
      publicReviews,
      avgRating
    };
  }

  /**
   * Detect anomalies by comparing current vs previous period
   */
  private detectAnomalies(rawData: RawMetricData): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check expenses anomaly (if increase > 40%)
    if (rawData.previous.expenses > 0) {
      const expenseChange = this.calculatePercentChange(
        rawData.previous.expenses,
        rawData.current.expenses
      );

      if (expenseChange > 40) {
        anomalies.push({
          metric: 'expenses',
          change: `+${Math.round(expenseChange)}%`,
          severity: 'warning',
          recommendation: 'Review recent expense entries for unusual charges'
        });
      }
    }

    // Check revenue drop (if decrease > 30%)
    if (rawData.previous.revenue > 0) {
      const revenueChange = this.calculatePercentChange(
        rawData.previous.revenue,
        rawData.current.revenue
      );

      if (revenueChange < -30) {
        anomalies.push({
          metric: 'revenue',
          change: `${Math.round(revenueChange)}%`,
          severity: 'critical',
          recommendation: 'Revenue dropped significantly. Review pipeline and follow-ups'
        });
      }
    }

    // Check win rate drop (if decrease > 20 percentage points)
    const previousWinRate = this.calculateWinRate(
      rawData.previous.dealsWon,
      rawData.previous.dealsLost
    );
    const currentWinRate = this.calculateWinRate(
      rawData.current.dealsWon,
      rawData.current.dealsLost
    );

    if (previousWinRate > 0 && currentWinRate - previousWinRate < -20) {
      anomalies.push({
        metric: 'winRate',
        change: `${Math.round(currentWinRate - previousWinRate)} points`,
        severity: 'warning',
        recommendation: 'Win rate declined. Review recent losses for patterns'
      });
    }

    // Check billable hours drop (if decrease > 25%)
    if (rawData.previous.billableHours > 0) {
      const hoursChange = this.calculatePercentChange(
        rawData.previous.billableHours,
        rawData.current.billableHours
      );

      if (hoursChange < -25) {
        anomalies.push({
          metric: 'billableHours',
          change: `${Math.round(hoursChange)}%`,
          severity: 'warning',
          recommendation: 'Billable hours decreased. Check if you need more client work'
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate percent change between two values
   */
  private calculatePercentChange(previous: number, current: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate win rate from deals won and lost
   */
  private calculateWinRate(won: number, lost: number): number {
    const total = won + lost;
    return total > 0 ? Math.round((won / total) * 100) : 0;
  }

  /**
   * Convert timeframe string to number of days
   */
  private timeframeToDays(timeframe: MetricsTimeframe): number {
    switch (timeframe) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        return 30;
    }
  }

  /**
   * Clear cache for a user (useful when data is updated)
   */
  clearCache(userId: string, timeframe?: MetricsTimeframe): void {
    clearMetricsCache(userId, timeframe);
    logger.info('Metrics cache cleared', { userId, timeframe });
  }
}
