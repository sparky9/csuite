import { getSourcesDueForCheck } from 'research-insights';
import { ResearchInsightsModule } from '../modules/research-insights.module.js';
import { logger } from '../utils/logger.js';

let monitorInterval: NodeJS.Timeout | null = null;
let isRunning = false;

const researchModule = new ResearchInsightsModule();

/**
 * Run scheduled monitoring check
 * This checks all sources that are due for monitoring based on their frequency
 */
async function runScheduledCheck(): Promise<void> {
  if (isRunning) {
    logger.debug('Scheduled check already running, skipping this cycle');
    return;
  }

  isRunning = true;

  try {
    const dueList = await getSourcesDueForCheck();

    if (!dueList.length) {
      logger.debug('No sources due for monitoring');
      isRunning = false;
      return;
    }

    logger.info('Running scheduled research monitoring', {
      sourcesCount: dueList.length
    });

    // Group by user to batch process
    const byUser = new Map<string, string[]>();
    for (const source of dueList) {
      const existing = byUser.get(source.userId) || [];
      existing.push(source.sourceId);
      byUser.set(source.userId, existing);
    }

    // Process each user's sources
    for (const [userId, sourceIds] of byUser.entries()) {
      try {
        await researchModule.runMonitor({ sourceIds }, userId);
        logger.info('Scheduled monitoring completed for user', {
          userId,
          sourcesCount: sourceIds.length
        });
      } catch (error) {
        logger.error('Scheduled monitoring failed for user', {
          userId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } catch (error) {
    logger.error('Scheduled check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background monitoring service
 * Runs checks every 5 minutes to see if any sources are due
 */
export function startBackgroundMonitor(checkIntervalMs: number = 5 * 60 * 1000): void {
  if (monitorInterval) {
    logger.warn('Background monitor already running');
    return;
  }

  logger.info('Starting background research monitor', {
    checkIntervalMs,
    checkIntervalMinutes: checkIntervalMs / 60000
  });

  // Run immediately on start
  runScheduledCheck().catch((error) => {
    logger.error('Initial scheduled check failed', { error });
  });

  // Then run on interval
  monitorInterval = setInterval(() => {
    runScheduledCheck().catch((error) => {
      logger.error('Scheduled check failed', { error });
    });
  }, checkIntervalMs);
}

/**
 * Stop the background monitoring service
 */
export function stopBackgroundMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('Background research monitor stopped');
  }
}

/**
 * Check if background monitor is running
 */
export function isBackgroundMonitorRunning(): boolean {
  return monitorInterval !== null;
}
