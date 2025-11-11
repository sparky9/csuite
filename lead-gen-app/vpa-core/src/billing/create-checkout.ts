/**
 * Stripe Checkout Session Creation
 *
 * Creates Stripe checkout sessions for VPA subscription purchases.
 * Supports trial periods, custom success/cancel URLs, and promotion codes.
 */

import { stripe } from './stripe-client.js';
import { logger } from '../utils/logger.js';

export interface CheckoutSessionParams {
  priceId: string;
  customerEmail?: string;
  customerId?: string;
  trialDays?: number;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string | null;
  customer: string | null;
}

/**
 * Create a Stripe Checkout session for subscription purchase
 */
export async function createCheckoutSession(
  params: CheckoutSessionParams
): Promise<CheckoutSessionResult> {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      customer: params.customerId,
      customer_email: !params.customerId ? params.customerEmail : undefined,
      subscription_data: params.trialDays
        ? {
            trial_period_days: params.trialDays,
            metadata: params.metadata,
          }
        : {
            metadata: params.metadata,
          },
      success_url: params.successUrl || process.env.STRIPE_SUCCESS_URL || 'https://yourapp.com/success',
      cancel_url: params.cancelUrl || process.env.STRIPE_CANCEL_URL || 'https://yourapp.com/pricing',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        source: 'vpa_self_signup',
        ...params.metadata,
      },
    });

    logger.info('Checkout session created', {
      session_id: session.id,
      customer_email: params.customerEmail,
      price_id: params.priceId,
      trial_days: params.trialDays,
    });

    return {
      id: session.id,
      url: session.url,
      customer: session.customer as string | null,
    };
  } catch (error) {
    logger.error('Failed to create checkout session', {
      error: error instanceof Error ? error.message : String(error),
      params,
    });
    throw error;
  }
}

/**
 * Retrieve a checkout session by ID
 */
export async function retrieveCheckoutSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    logger.error('Failed to retrieve checkout session', {
      error: error instanceof Error ? error.message : String(error),
      session_id: sessionId,
    });
    throw error;
  }
}
