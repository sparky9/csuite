/**
 * Stripe Client
 *
 * Singleton Stripe instance for VPA Core billing operations.
 * Configured with API key from environment variables.
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2023-10-16';

/**
 * Stripe singleton instance
 * Uses latest API version with TypeScript support
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
});

logger.info('Stripe client initialized', {
  apiVersion: STRIPE_API_VERSION
});
