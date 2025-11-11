# Stripe Integration - Quick Start Guide

**Goal**: Get Stripe billing working in 10 minutes

---

## Prerequisites

- ✅ VPA Core installed
- ✅ Database setup complete
- ✅ Stripe account created

---

## 5-Step Setup

### Step 1: Install Dependencies (1 min)

```bash
cd vpa-core
npm install
```

This installs `stripe` and `express` packages.

---

### Step 2: Configure Stripe Keys (2 min)

1. Get your Stripe keys:
   - Login to [Stripe Dashboard](https://dashboard.stripe.com)
   - Go to **Developers > API keys**
   - Copy **Secret key** (starts with `sk_test_...`)

2. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Stripe key:
   ```env
   STRIPE_SECRET_KEY=sk_test_paste_your_key_here
   STRIPE_WEBHOOK_SECRET=  # Leave empty for now
   STRIPE_SUCCESS_URL=https://yourapp.com/success
   STRIPE_CANCEL_URL=https://yourapp.com/pricing
   ```

---

### Step 3: Create Stripe Products (2 min)

```bash
npm run stripe:setup
```

**What this does**: Creates 4 VPA products in Stripe with correct pricing.

**Save the output!** You'll see:
```
✅ VPA Core Only
   Product ID: prod_ABC123
   Price ID:   price_XYZ789    ← COPY THIS
```

Save all 4 **Price IDs** - you'll need them next.

---

### Step 4: Setup Webhook Forwarding (3 min)

**Option A: Stripe CLI (Recommended)**

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop install stripe
   ```

2. Login:
   ```bash
   stripe login
   ```

3. Start webhook server (Terminal 1):
   ```bash
   npm run webhook:server
   ```

4. Forward webhooks (Terminal 2):
   ```bash
   stripe listen --forward-to localhost:3000/webhook
   ```

5. Copy the webhook secret from output:
   ```
   > Ready! Your webhook signing secret is whsec_abc123...
   ```

6. Add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_paste_secret_here
   ```

7. Restart webhook server (Ctrl+C in Terminal 1, then):
   ```bash
   npm run webhook:server
   ```

**Option B: Skip webhooks for now**

You can create checkout links without webhooks, but users won't be created automatically. Useful for testing checkout UI only.

---

### Step 5: Create Test Checkout Link (2 min)

```bash
npm run stripe:checkout
```

Follow prompts:
1. Select plan: `4` (VPA Complete Bundle)
2. Email: `test@example.com`
3. Trial days: `7`
4. Price ID: `price_XYZ789` (from Step 3)

**Output**: Checkout URL like `https://checkout.stripe.com/c/pay/cs_test_...`

---

## Test the Flow

1. **Open checkout URL** in browser
2. **Enter test card**: `4242 4242 4242 4242`
3. **Expiry**: Any future date (e.g., `12/25`)
4. **CVC**: Any 3 digits (e.g., `123`)
5. **Click "Subscribe"**

**Result**:
- Redirects to success URL
- Webhook received (check Terminal 2)
- User created in database!

**Verify**:
```bash
npm run admin:list-users
```

You should see `test@example.com` with a license key!

---

## Common Issues

### "STRIPE_SECRET_KEY is required"

**Fix**: Add `STRIPE_SECRET_KEY` to `.env` file

### "Webhook signature verification failed"

**Fix**: Set `STRIPE_WEBHOOK_SECRET` in `.env` (from `stripe listen` output)

### "No customer email in session"

**Fix**: Enter email when creating checkout link

---

## Next Steps

1. ✅ Test signup flow works
2. ✅ Test cancellation (via Stripe Dashboard)
3. ✅ Read `STRIPE_SETUP.md` for production deployment
4. ✅ Read `STRIPE_TESTING.md` for comprehensive test scenarios

---

## Production Deployment

When ready to go live:

1. Switch to production Stripe keys (`sk_live_...`)
2. Run `npm run stripe:setup` again (creates products in live mode)
3. Deploy webhook server to production
4. Configure production webhook endpoint in Stripe Dashboard
5. Update success/cancel URLs to production domains

See `STRIPE_SETUP.md` for detailed production guide.

---

## Useful Commands

```bash
# Create checkout link
npm run stripe:checkout

# Start webhook server
npm run webhook:server

# View users
npm run admin:list-users

# Trigger test webhook
stripe trigger checkout.session.completed

# View Stripe Dashboard
stripe dashboard
```

---

## Need Help?

1. **Setup issues**: See `STRIPE_SETUP.md`
2. **Testing**: See `STRIPE_TESTING.md`
3. **Overview**: See `STRIPE_INTEGRATION_SUMMARY.md`
4. **Stripe Docs**: [stripe.com/docs](https://stripe.com/docs)

---

**You're ready to accept payments! 🎉**
