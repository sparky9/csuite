import './helpers/test-env.ts';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCheckoutCompleted,
  handleInvoicePaymentFailed,
} from '../src/billing/webhook-handlers.ts';
import { db } from '../src/db/client.ts';
import { stripe } from '../src/billing/stripe-client.ts';

test('handleCheckoutCompleted upserts subscription data for new customer', async () => {
  const originalConnect = db.connect;
  const originalTransaction = db.transaction;
  const originalStripeRetrieve = stripe.subscriptions.retrieve;

  const txQueries: Array<{ sql: string; params?: any[] }> = [];
  const stripeCalls: string[] = [];

  (db as any).connect = async () => undefined;
  (db as any).transaction = async (callback: (client: any) => Promise<any>) => {
    const client = {
      async query(sql: string, params?: any[]) {
        txQueries.push({ sql, params });

        if (sql.includes('SELECT user_id')) {
          return { rows: [], rowCount: 0 };
        }

        if (sql.startsWith('INSERT INTO users')) {
          return { rows: [{ user_id: 'user-generated' }], rowCount: 1 };
        }

        if (sql.startsWith('INSERT INTO user_subscriptions')) {
          return { rows: [], rowCount: 1 };
        }

        throw new Error(`Unexpected query: ${sql}`);
      },
    };

    return callback(client);
  };

  stripe.subscriptions.retrieve = async (subscriptionId: string) => {
    stripeCalls.push(subscriptionId);
    const now = Math.floor(Date.now() / 1000);

    return {
      id: subscriptionId,
      status: 'active',
      current_period_start: now,
      current_period_end: now + 3600,
      trial_end: null,
      items: {
        data: [
          {
            price: { unit_amount: 9900 },
          },
        ],
      },
    } as any;
  };

  try {
    await handleCheckoutCompleted({
      id: 'cs_test_123',
      customer: 'cus_test_123',
      customer_email: 'founder@example.com',
      subscription: 'sub_test_123',
    } as any);

    assert.equal(stripeCalls[0], 'sub_test_123');
    assert.equal(txQueries.length, 3);
    assert.match(txQueries[0].sql, /SELECT user_id/i);
    assert.equal(txQueries[0].params?.[0], 'founder@example.com');
    assert.match(txQueries[1].sql, /INSERT INTO users/i);
    assert.match(txQueries[2].sql, /INSERT INTO user_subscriptions/i);
    assert.equal(txQueries[2].params?.[0], 'user-generated');
  } finally {
    (db as any).connect = originalConnect;
    (db as any).transaction = originalTransaction;
    stripe.subscriptions.retrieve = originalStripeRetrieve;
  }
});

test('handleInvoicePaymentFailed marks subscription as past due', async () => {
  const originalConnect = db.connect;
  const originalQuery = db.query;

  const queries: Array<{ sql: string; params?: any[] }> = [];

  (db as any).connect = async () => undefined;
  (db as any).query = async (sql: string, params?: any[]) => {
    queries.push({ sql, params });
    return { rows: [{ user_id: 'user-1' }], rowCount: 1 };
  };

  try {
    await handleInvoicePaymentFailed({
      id: 'in_test_123',
      subscription: 'sub_test_123',
      customer: 'cus_test_123',
    } as any);

    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /UPDATE user_subscriptions/i);
    assert.equal(queries[0].params?.[0], 'sub_test_123');
  } finally {
    (db as any).connect = originalConnect;
    (db as any).query = originalQuery;
  }
});
