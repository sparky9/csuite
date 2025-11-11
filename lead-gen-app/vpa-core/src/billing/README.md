# VPA Core Billing System

Stripe integration for automated subscription billing and management.

---

## Overview

This module provides complete Stripe integration for VPA Core, enabling:

- ✅ Self-service subscription signups
- ✅ Automated recurring billing
- ✅ Customer portal for subscription management
- ✅ Webhook-based database synchronization
- ✅ Trial periods and promotion codes
- ✅ Payment failure handling

---

## Architecture

```
┌─────────────┐
│  Customer   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Stripe Checkout     │  ← Hosted by Stripe (PCI compliant)
│ (Payment Form)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Stripe Backend      │  ← Payment processing
└──────┬──────────────┘
       │
       │ Webhook Event
       ▼
┌─────────────────────┐
│ VPA Webhook Server  │  ← webhook-server.ts (Express)
│ (This Module)       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Event Handlers      │  ← webhook-handlers.ts
│ - Checkout Complete │
│ - Subscription Upd  │
│ - Cancellation      │
│ - Payment Failed    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ VPA Database        │  ← PostgreSQL
│ - users             │
│ - user_subscriptions│
└─────────────────────┘
```

---

## Module Files

### Core Components

**stripe-client.ts**
- Stripe SDK singleton instance
- Configured with API keys from environment
- Used by all other modules

**create-checkout.ts**
- Creates Stripe checkout sessions
- Supports trials, custom URLs, metadata
- Returns checkout URL for customer

**webhook-server.ts**
- Express server listening for Stripe events
- Verifies webhook signatures
- Routes events to handlers
- Standalone server (run via `npm run webhook:server`)

**webhook-handlers.ts**
- Processes specific Stripe events
- Creates/updates users and subscriptions
- Handles payment failures and cancellations
- Transaction-safe database operations

**create-portal.ts**
- Generates Stripe customer portal sessions
- Enables self-service subscription management
- Returns portal URL for customer

---

## Environment Variables

Required in `.env`:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_or_sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_or_pk_live_your_key

# Webhook Configuration
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Redirect URLs
STRIPE_SUCCESS_URL=https://yourapp.com/success
STRIPE_CANCEL_URL=https://yourapp.com/pricing

# Server Configuration
WEBHOOK_PORT=3000
```

---

## Usage Examples

### Create Checkout Session

```typescript
import { createCheckoutSession } from './billing/create-checkout.js';

const session = await createCheckoutSession({
  priceId: 'price_1234567890',  // From Stripe Dashboard
  customerEmail: 'customer@example.com',
  trialDays: 7,
  metadata: {
    plan_id: 'vpa-bundle',
    source: 'website'
  }
});

console.log('Checkout URL:', session.url);
// Redirect customer to: session.url
```

### Create Customer Portal Session

```typescript
import { createCustomerPortalSession } from './billing/create-portal.js';

const session = await createCustomerPortalSession({
  customerId: 'cus_1234567890',  // From user.metadata.stripe_customer_id
  returnUrl: 'https://yourapp.com/dashboard'
});

console.log('Portal URL:', session.url);
// Redirect customer to: session.url
```

### Start Webhook Server

```bash
npm run webhook:server
```

Server listens on `http://localhost:3000/webhook`

---

## Webhook Events Handled

### checkout.session.completed
**When**: Customer completes payment
**Action**:
- Creates user in database (or updates existing)
- Generates license key
- Creates subscription record
- Stores Stripe customer and subscription IDs

### customer.subscription.updated
**When**: Subscription changes (renewal, plan change, trial end)
**Action**:
- Updates subscription status
- Updates billing period dates
- Updates trial end date

### customer.subscription.deleted
**When**: Customer cancels subscription
**Action**:
- Marks subscription as `cancelled`
- Marks user as `cancelled`
- Revokes VPA access

### invoice.payment_failed
**When**: Recurring payment fails
**Action**:
- Marks subscription as `past_due`
- Customer has grace period to update payment
- TODO: Send payment failed email

### invoice.payment_succeeded
**When**: Payment succeeds (including after past_due)
**Action**:
- Marks subscription as `active`
- Reactivates access

---

## Database Schema

### users table
```sql
metadata JSONB {
  "stripe_customer_id": "cus_1234567890"
}
```

### user_subscriptions table
```sql
stripe_customer_id    VARCHAR(255)  -- Stripe customer reference
stripe_subscription_id VARCHAR(255) -- Stripe subscription reference
status                VARCHAR(50)   -- active, trialing, past_due, cancelled
trial_end             TIMESTAMP     -- Trial period end
current_period_start  TIMESTAMP     -- Billing period start
current_period_end    TIMESTAMP     -- Billing period end
```

---

## Error Handling

### Webhook Processing Errors

**Signature Verification Failed**
- Returns `400 Bad Request`
- Logs error
- Stripe does NOT retry

**Handler Error (Database, etc.)**
- Returns `200 OK` (to prevent Stripe retries for unrecoverable errors)
- Logs detailed error with stack trace
- Manual intervention may be required

**Unknown Event Type**
- Returns `200 OK`
- Logs info message
- Safely ignored

### Database Errors

All database operations use transactions:
```typescript
await db.transaction(async (client) => {
  // Multiple operations
  // All succeed or all rollback
});
```

### Idempotency

Webhook handlers are idempotent - safe to replay:
- Uses `ON CONFLICT` clauses in SQL
- Duplicate events don't cause duplicate users

---

## Testing

### Local Testing

```bash
# Terminal 1: Webhook server
npm run webhook:server

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/webhook

# Terminal 3: Trigger events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

### Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

All cards: Any future expiry, any 3-digit CVC

---

## Security

✅ **Webhook Signature Verification**
- Every webhook verified with signing secret
- Prevents spoofed requests

✅ **API Key Security**
- Never committed to code
- Stored in environment variables

✅ **PCI Compliance**
- No card data touches VPA servers
- All payment data handled by Stripe

✅ **SQL Injection Prevention**
- Parameterized queries throughout
- No string concatenation in SQL

---

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "service": "vpa-stripe-webhooks",
  "timestamp": "2024-10-21T12:00:00.000Z"
}
```

### Webhook Logs

Check application logs:
```bash
tail -f logs/vpa-combined.log
```

Check Stripe webhook delivery:
- Stripe Dashboard > Webhooks > View logs

---

## Troubleshooting

### Common Issues

**Problem**: "Webhook signature verification failed"
**Solution**: Ensure `STRIPE_WEBHOOK_SECRET` matches webhook endpoint in Stripe Dashboard

**Problem**: "Database not connected"
**Solution**: Verify `DATABASE_URL` in `.env`, run `npm run admin:health`

**Problem**: "Subscription not found"
**Solution**: Ensure `checkout.session.completed` webhook processed first

**Problem**: User created but subscription missing
**Solution**: Check webhook logs for errors, verify transaction completed

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Switch to production Stripe keys (`sk_live_...`)
- [ ] Deploy webhook server with HTTPS
- [ ] Configure production webhook endpoint in Stripe
- [ ] Update success/cancel URLs
- [ ] Test with real card (then refund)
- [ ] Set up monitoring and alerts

### Deployment Steps

1. Deploy webhook server to production environment
2. Ensure HTTPS enabled (required by Stripe)
3. Add webhook endpoint in Stripe Dashboard
4. Copy webhook signing secret to production environment
5. Verify first transaction processes correctly

---

## Future Enhancements

TODOs marked in code:

1. **Email Notifications**
   - Welcome email with license key
   - Payment failure notifications
   - Cancellation confirmations

2. **Analytics**
   - MRR tracking
   - Churn metrics
   - Conversion rates

3. **Advanced Features**
   - Proration for plan changes
   - Metered billing for usage-based pricing
   - Multi-currency support

---

## References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

---

## Support

For issues or questions:

1. Check `STRIPE_SETUP.md` for configuration
2. Check `STRIPE_TESTING.md` for test scenarios
3. Review Stripe Dashboard webhook logs
4. Check application logs for errors

---

**Module Version**: 1.0.0
**Last Updated**: 2024-10-21
**Author**: Forge (Technical Architect)
