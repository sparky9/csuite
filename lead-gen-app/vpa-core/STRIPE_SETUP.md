# Stripe Integration Setup Guide

Complete guide to configure Stripe billing for VPA Core.

## Prerequisites

1. **Stripe Account**: Sign up at [https://stripe.com](https://stripe.com)
2. **VPA Core Installed**: Complete database setup
3. **Node.js**: Version 18 or higher

---

## Step 1: Get Stripe API Keys

1. Login to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers > API keys**
3. Copy your keys:
   - **Publishable key**: `pk_test_...` (for frontend, if needed)
   - **Secret key**: `sk_test_...` (for backend - KEEP SECURE!)

---

## Step 2: Configure Environment Variables

Edit your `vpa-core/.env` file:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here

# Redirect URLs (customize for your app)
STRIPE_SUCCESS_URL=https://yourapp.com/success
STRIPE_CANCEL_URL=https://yourapp.com/pricing

# Webhook port (default: 3000)
WEBHOOK_PORT=3000
```

**Important Security Notes:**
- Never commit your `.env` file to version control
- Use different keys for test and production environments
- Store production keys in secure environment variable services

---

## Step 3: Create Stripe Products

Run the setup script to create products in Stripe matching your VPA pricing plans:

```bash
cd vpa-core
npm run stripe:setup
```

**What this does:**
- Creates 4 Stripe products (VPA Core Only, VPA + ProspectFinder, VPA + Email, VPA Complete Bundle)
- Creates monthly recurring prices for each product
- Displays Product IDs and Price IDs

**Save the output!** You'll need the Price IDs for creating checkout sessions.

Example output:
```
✅ VPA Core Only
   Product ID: prod_ABC123
   Price ID:   price_XYZ789
   Amount:     $30/month
```

---

## Step 4: Setup Stripe Webhook

Webhooks are **critical** - they sync subscription state between Stripe and VPA database.

### Development/Testing (Local)

**Option A: Stripe CLI (Recommended for local development)**

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
   scoop install stripe

   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Start webhook server:
   ```bash
   npm run webhook:server
   ```

4. In another terminal, forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/webhook
   ```

   This will output a webhook signing secret like `whsec_...`

5. Add webhook secret to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

**Option B: ngrok (Alternative)**

1. Start webhook server:
   ```bash
   npm run webhook:server
   ```

2. Expose with ngrok:
   ```bash
   ngrok http 3000
   ```

3. Add webhook in Stripe Dashboard (see Production setup below), using ngrok URL

### Production

1. Deploy webhook server to your production environment

2. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)

3. Click **"Add endpoint"**

4. Configure endpoint:
   - **Endpoint URL**: `https://yourdomain.com/webhook`
   - **Events to listen for**: Select these events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`

5. Click **"Add endpoint"**

6. Copy the **Signing secret** (starts with `whsec_`)

7. Add to production environment variables:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
   ```

---

## Step 5: Test the Integration

### Test Checkout Flow

1. Create a test checkout link:
   ```bash
   npm run stripe:checkout
   ```

2. Follow the prompts:
   - Select a plan
   - Enter test email
   - Enter the Price ID from Step 3
   - Optional: Add trial days

3. Open the generated checkout URL in browser

4. Use Stripe test card:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: Any future date
   - **CVC**: Any 3 digits

5. Complete checkout

6. Verify in database:
   ```bash
   npm run admin:list-users
   ```

   You should see the new user with subscription!

### Test Webhook Events

With Stripe CLI:

```bash
# Trigger checkout completed
stripe trigger checkout.session.completed

# Trigger payment failure
stripe trigger invoice.payment_failed

# Trigger subscription cancellation
stripe trigger customer.subscription.deleted
```

Check webhook server logs for processing confirmation.

---

## Step 6: Customer Self-Service Portal

Enable customers to manage their subscriptions:

1. Go to [Stripe Dashboard > Settings > Billing](https://dashboard.stripe.com/settings/billing/portal)

2. Configure customer portal:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to view billing history
   - ✅ Allow customers to cancel subscriptions
   - Optional: Configure cancellation behavior (immediate vs. end of period)

3. Save settings

**Using the portal in your app:**

```typescript
import { createCustomerPortalSession } from './src/billing/create-portal.js';

// Get Stripe customer ID from user's metadata
const session = await createCustomerPortalSession({
  customerId: user.metadata.stripe_customer_id,
  returnUrl: 'https://yourapp.com/dashboard'
});

// Redirect user to: session.url
```

---

## Step 7: Production Deployment

### Environment Setup

1. Use production Stripe keys (start with `pk_live_` and `sk_live_`)
2. Setup production webhook endpoint (Step 4)
3. Update success/cancel URLs to production domains
4. Configure production database

### Security Checklist

- [ ] Secret keys stored in secure environment variables (not in code)
- [ ] Webhook signature verification enabled (`STRIPE_WEBHOOK_SECRET` set)
- [ ] HTTPS enabled for webhook endpoint
- [ ] Database connection uses SSL
- [ ] `.env` file not committed to version control
- [ ] Production logs monitored for errors

### Monitoring

Monitor these in production:

- **Webhook delivery**: Stripe Dashboard > Webhooks > View logs
- **Failed payments**: Set up Stripe email notifications
- **Subscription metrics**: Stripe Dashboard > Revenue
- **Application logs**: Check for webhook processing errors

---

## Troubleshooting

### "Webhook signature verification failed"

**Cause**: `STRIPE_WEBHOOK_SECRET` not set or incorrect

**Fix**:
1. Check `.env` file has correct `STRIPE_WEBHOOK_SECRET`
2. Verify it matches webhook endpoint in Stripe Dashboard
3. Restart webhook server after changing `.env`

### "No customer email in checkout session"

**Cause**: Checkout session missing customer details

**Fix**: Ensure you pass `customerEmail` or `customerId` when creating checkout session

### "Subscription not found in database"

**Cause**: Webhook received for subscription not created via checkout

**Fix**: Ensure `checkout.session.completed` webhook processed first - it creates the database record

### "Database not connected"

**Cause**: `DATABASE_URL` not set or database unreachable

**Fix**:
1. Verify `DATABASE_URL` in `.env`
2. Test database connection: `npm run admin:health`
3. Check database server is running

---

## Testing in Production

**DO NOT** use live checkout links without testing first!

### Test Mode Checklist

- [ ] Used test API keys (`sk_test_...`)
- [ ] Created products in test mode
- [ ] Webhook receiving test events
- [ ] Database writes working
- [ ] User and subscription created correctly

### Production Launch Checklist

- [ ] Switch to production API keys (`sk_live_...`)
- [ ] Recreate products in production mode (run `stripe:setup` with live keys)
- [ ] Update webhook endpoint to production URL
- [ ] Test full flow with real card (then refund)
- [ ] Monitor first few real transactions closely

---

## Common Workflows

### Create Checkout Link Manually

```bash
npm run stripe:checkout
```

### View Stripe Dashboard

```bash
stripe dashboard
# Or visit: https://dashboard.stripe.com
```

### Test Webhooks Locally

```bash
# Terminal 1
npm run webhook:server

# Terminal 2
stripe listen --forward-to localhost:3000/webhook

# Terminal 3
stripe trigger checkout.session.completed
```

### Check Database Sync

```bash
npm run admin:list-users
npm run admin:manage-subs
```

---

## Support Resources

- **Stripe Docs**: [https://stripe.com/docs](https://stripe.com/docs)
- **Stripe API Reference**: [https://stripe.com/docs/api](https://stripe.com/docs/api)
- **Stripe CLI Docs**: [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
- **Webhooks Guide**: [https://stripe.com/docs/webhooks](https://stripe.com/docs/webhooks)
- **Test Cards**: [https://stripe.com/docs/testing](https://stripe.com/docs/testing)

---

## Next Steps

1. ✅ Complete this setup
2. ✅ Test checkout flow thoroughly
3. ✅ Verify webhook processing
4. ✅ Test customer portal
5. 📖 Read `STRIPE_TESTING.md` for comprehensive test scenarios
6. 🚀 Deploy to production when ready

---

**Questions?** See `STRIPE_TESTING.md` for detailed test scenarios and edge cases.
