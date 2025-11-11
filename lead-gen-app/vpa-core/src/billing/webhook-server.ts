#!/usr/bin/env node

/**
 * Stripe Webhook Server
 *
 * Express server to receive and process Stripe webhook events.
 * This is the critical component for automated billing - it keeps VPA database
 * in sync with Stripe subscription state.
 *
 * Usage: npm run webhook:server
 */

import express from 'express';
import { stripe } from './stripe-client.js';
import { logger } from '../utils/logger.js';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from './webhook-handlers.js';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();

/**
 * Stripe webhook endpoint
 * IMPORTANT: Must use express.raw() for signature verification
 */
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      logger.error('Missing Stripe signature header');
      return res.status(400).send('Missing signature');
    }

    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook not configured');
    }

  let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    logger.info('Webhook event received', {
      type: event.type,
      id: event.id,
    });

    try {
      // Route to appropriate handler
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.info('Unhandled webhook event type', {
            type: event.type,
          });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook handler error', {
        error: error instanceof Error ? error.message : String(error),
        event_type: event.type,
        event_id: event.id,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Still return 200 to Stripe to avoid retries for unrecoverable errors
      // Stripe will retry on 5xx errors
      res.status(200).json({
        received: true,
        error: 'Handler failed but acknowledged',
      });
    }
  }
);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vpa-stripe-webhooks',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root endpoint (for testing)
 */
app.get('/', (req, res) => {
  res.json({
    service: 'VPA Stripe Webhook Server',
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /webhook',
      health: 'GET /health',
    },
  });
});

/**
 * Start server
 */
const PORT = process.env.WEBHOOK_PORT || 3000;

app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 VPA Stripe Webhook Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check:     http://localhost:${PORT}/health\n`);

  logger.info('Stripe webhook server started', {
    port: PORT,
    node_env: process.env.NODE_ENV || 'development',
  });

  console.log('⚙️  Configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Webhook Secret: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}\n`);

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not set!');
    console.log('   Webhook signature verification will fail.');
    console.log('   See STRIPE_SETUP.md for configuration instructions.\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📖 Listening for webhook events...\n');
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  console.log('\n👋 Shutting down webhook server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  console.log('\n👋 Shutting down webhook server...');
  process.exit(0);
});
