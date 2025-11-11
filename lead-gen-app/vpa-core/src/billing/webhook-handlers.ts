/**
 * Stripe Webhook Event Handlers
 *
 * Processes Stripe webhook events to sync subscription state with VPA database.
 * Critical for automated billing - handles checkout, updates, cancellations, and payment failures.
 */

import Stripe from 'stripe';
import { stripe } from './stripe-client.js';
import { db } from '../db/client.js';
import { queryOne, queryAll, execute } from '../db/helpers.js';
import { logger } from '../utils/logger.js';
import { PRICING_PLANS } from '../config/pricing.js';
import crypto from 'crypto';

/**
 * Generate a unique VPA license key
 */
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `VPA-${segments.join('-')}`;
}

/**
 * Find plan by price amount (in cents)
 */
function findPlanByPrice(priceAmount: number | null) {
  if (!priceAmount) return null;
  return PRICING_PLANS.find((p) => p.priceMonthly === priceAmount);
}

/**
 * Handle checkout.session.completed
 * Creates or updates user and subscription when payment succeeds
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  logger.info('Processing checkout.session.completed', {
    session_id: session.id,
  });

  try {
    const customerEmail =
      session.customer_email || session.customer_details?.email;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerEmail) {
      throw new Error('No customer email in checkout session');
    }

    if (!subscriptionId) {
      throw new Error('No subscription ID in checkout session');
    }

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceAmount = subscription.items.data[0]?.price.unit_amount;
    const plan = findPlanByPrice(priceAmount);

    if (!plan) {
      throw new Error(
        `No VPA plan found matching price: $${(priceAmount || 0) / 100}`
      );
    }

    await db.connect();

    // Use transaction for atomicity
    await db.transaction(async (client) => {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT user_id, metadata FROM users WHERE email = $1',
        [customerEmail]
      );

      let userId: string;

      if (existingUser.rows.length > 0) {
        // Update existing user
        userId = existingUser.rows[0].user_id;

        const metadata = existingUser.rows[0].metadata || {};
        metadata.stripe_customer_id = customerId;

        await client.query(
          `UPDATE users
           SET status = 'active',
               metadata = $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [JSON.stringify(metadata), userId]
        );

        logger.info('Updated existing user with Stripe customer', {
          user_id: userId,
          email: customerEmail,
        });
      } else {
        // Create new user
        const licenseKey = generateLicenseKey();
        const customerName =
          session.customer_details?.name || customerEmail.split('@')[0];

        const newUserResult = await client.query(
          `INSERT INTO users (email, name, license_key, status, metadata)
           VALUES ($1, $2, $3, 'active', $4)
           RETURNING user_id`,
          [
            customerEmail,
            customerName,
            licenseKey,
            JSON.stringify({ stripe_customer_id: customerId }),
          ]
        );

        userId = newUserResult.rows[0].user_id;

        logger.info('Created new user from Stripe checkout', {
          user_id: userId,
          email: customerEmail,
          license_key: licenseKey,
        });
      }

      // Create or update subscription
      const now = new Date();
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);
      const trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null;

      await client.query(
        `INSERT INTO user_subscriptions (
          user_id, plan_name, modules, price_monthly, status,
          trial_end, current_period_start, current_period_end,
          stripe_customer_id, stripe_subscription_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id)
        DO UPDATE SET
          plan_name = EXCLUDED.plan_name,
          modules = EXCLUDED.modules,
          price_monthly = EXCLUDED.price_monthly,
          status = EXCLUDED.status,
          trial_end = EXCLUDED.trial_end,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          stripe_subscription_id = EXCLUDED.stripe_subscription_id,
          updated_at = NOW()`,
        [
          userId,
          plan.name,
          plan.modules,
          plan.priceMonthly,
          subscription.status === 'trialing' ? 'trialing' : 'active',
          trialEnd,
          periodStart,
          periodEnd,
          customerId,
          subscriptionId,
        ]
      );

      logger.info('User subscription created/updated from checkout', {
        user_id: userId,
        plan: plan.name,
        subscription_id: subscriptionId,
        status: subscription.status,
      });
    });

    logger.info('Checkout completed successfully', {
      session_id: session.id,
      customer_email: customerEmail,
    });

    // TODO: Send welcome email with license key and setup instructions

  } catch (error) {
    logger.error('Failed to process checkout.session.completed', {
      error: error instanceof Error ? error.message : String(error),
      session_id: session.id,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Handle customer.subscription.updated
 * Updates subscription status when plan changes or billing period renews
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  logger.info('Processing customer.subscription.updated', {
    subscription_id: subscription.id,
    status: subscription.status,
  });

  try {
    await db.connect();

    const periodEnd = new Date(subscription.current_period_end * 1000);
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;

    const result = await db.query(
      `UPDATE user_subscriptions
       SET status = $1,
           current_period_end = $2,
           trial_end = $3,
           updated_at = NOW()
       WHERE stripe_subscription_id = $4
       RETURNING user_id`,
      [subscription.status, periodEnd, trialEnd, subscription.id]
    );

    if (result.rowCount === 0) {
      logger.warn('Subscription not found in database', {
        subscription_id: subscription.id,
      });
      return;
    }

    logger.info('Subscription updated successfully', {
      subscription_id: subscription.id,
      status: subscription.status,
      user_id: result.rows[0].user_id,
    });

  } catch (error) {
    logger.error('Failed to process subscription.updated', {
      error: error instanceof Error ? error.message : String(error),
      subscription_id: subscription.id,
    });
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted
 * Marks subscription and user as cancelled
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  logger.info('Processing customer.subscription.deleted', {
    subscription_id: subscription.id,
  });

  try {
    await db.connect();

    await db.transaction(async (client) => {
      // Update subscription status
      const subResult = await client.query(
        `UPDATE user_subscriptions
         SET status = 'cancelled',
             updated_at = NOW()
         WHERE stripe_subscription_id = $1
         RETURNING user_id`,
        [subscription.id]
      );

      if (subResult.rows.length === 0) {
        logger.warn('Subscription not found for deletion', {
          subscription_id: subscription.id,
        });
        return;
      }

      const userId = subResult.rows[0].user_id;

      // Update user status
      await client.query(
        `UPDATE users
         SET status = 'cancelled'
         WHERE user_id = $1`,
        [userId]
      );

      logger.info('Subscription cancelled', {
        subscription_id: subscription.id,
        user_id: userId,
      });
    });

    // TODO: Send cancellation confirmation email

  } catch (error) {
    logger.error('Failed to process subscription.deleted', {
      error: error instanceof Error ? error.message : String(error),
      subscription_id: subscription.id,
    });
    throw error;
  }
}

/**
 * Handle invoice.payment_failed
 * Marks subscription as past_due when payment fails
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  logger.warn('Processing invoice.payment_failed', {
    invoice_id: invoice.id,
    subscription_id: invoice.subscription,
    customer: invoice.customer,
  });

  try {
    if (!invoice.subscription) {
      logger.info('Invoice has no subscription, skipping');
      return;
    }

    await db.connect();

    const result = await db.query(
      `UPDATE user_subscriptions
       SET status = 'past_due',
           updated_at = NOW()
       WHERE stripe_subscription_id = $1
       RETURNING user_id`,
      [invoice.subscription]
    );

    if (result.rowCount === 0) {
      logger.warn('Subscription not found for failed payment', {
        subscription_id: invoice.subscription,
      });
      return;
    }

    logger.info('Subscription marked as past_due', {
      subscription_id: invoice.subscription,
      invoice_id: invoice.id,
      user_id: result.rows[0].user_id,
    });

    // TODO: Send payment failed email with update payment link

  } catch (error) {
    logger.error('Failed to process invoice.payment_failed', {
      error: error instanceof Error ? error.message : String(error),
      invoice_id: invoice.id,
    });
    // Don't throw - payment failures shouldn't crash webhook processing
  }
}

/**
 * Handle invoice.payment_succeeded
 * Updates subscription to active when payment succeeds (e.g., after past_due)
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  logger.info('Processing invoice.payment_succeeded', {
    invoice_id: invoice.id,
    subscription_id: invoice.subscription,
  });

  try {
    if (!invoice.subscription) {
      logger.info('Invoice has no subscription, skipping');
      return;
    }

    await db.connect();

    const result = await db.query(
      `UPDATE user_subscriptions
       SET status = 'active',
           updated_at = NOW()
       WHERE stripe_subscription_id = $1
         AND status = 'past_due'
       RETURNING user_id`,
      [invoice.subscription]
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.info('Subscription reactivated after successful payment', {
        subscription_id: invoice.subscription,
        user_id: result.rows[0].user_id,
      });
    }

  } catch (error) {
    logger.error('Failed to process invoice.payment_succeeded', {
      error: error instanceof Error ? error.message : String(error),
      invoice_id: invoice.id,
    });
  }
}
