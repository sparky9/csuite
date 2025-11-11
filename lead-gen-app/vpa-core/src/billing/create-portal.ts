/**
 * Stripe Customer Portal
 *
 * Creates Stripe customer portal sessions for self-service subscription management.
 * Customers can update payment methods, view invoices, and cancel subscriptions.
 */

import { stripe } from './stripe-client.js';
import { logger } from '../utils/logger.js';

export interface PortalSessionParams {
  customerId: string;
  returnUrl?: string;
}

export interface PortalSessionResult {
  id: string;
  url: string;
}

/**
 * Create a Stripe customer portal session
 *
 * Customers can:
 * - Update payment methods
 * - View billing history
 * - Download invoices
 * - Cancel subscriptions
 * - Update billing information
 */
export async function createCustomerPortalSession(
  params: PortalSessionParams
): Promise<PortalSessionResult> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl || process.env.STRIPE_SUCCESS_URL || 'https://yourapp.com/dashboard',
    });

    logger.info('Customer portal session created', {
      customer_id: params.customerId,
      session_id: session.id,
    });

    return {
      id: session.id,
      url: session.url,
    };
  } catch (error) {
    logger.error('Failed to create customer portal session', {
      error: error instanceof Error ? error.message : String(error),
      customer_id: params.customerId,
    });
    throw error;
  }
}

/**
 * Helper: Get customer ID from user email
 */
export async function getCustomerIdByEmail(email: string): Promise<string | null> {
  try {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return null;
    }

    return customers.data[0].id;
  } catch (error) {
    logger.error('Failed to find customer by email', {
      error: error instanceof Error ? error.message : String(error),
      email,
    });
    throw error;
  }
}
