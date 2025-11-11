# VPA Core - Complete Installation Guide

Step-by-step guide to get VPA Core running with Stripe billing.

---

## System Requirements

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v13 or higher (or Neon serverless)
- **npm**: v8 or higher
- **Stripe Account**: Free test account at [stripe.com](https://stripe.com)

---

## Installation Steps

### 1. Install Dependencies

```bash
cd vpa-core
npm install
```

**What this installs**:
- VPA Core dependencies (MCP SDK, Anthropic SDK, etc.)
- Stripe SDK v14.0.0
- Express for webhook server
- Database drivers (PostgreSQL)
- TypeScript tooling

**Verify**:
```bash
npm list stripe express
```

Should show:
```
├── stripe@14.0.0
└── express@4.18.2
```

---

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

**Edit `.env`** with your credentials:

```env
# Database (PostgreSQL or Neon)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Authentication
LICENSE_KEY=your-test-license-key

# Anthropic API (for LLM features)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Stripe Billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Get this in Step 5
STRIPE_SUCCESS_URL=https://yourapp.com/success
STRIPE_CANCEL_URL=https://yourapp.com/pricing

# Server
WEBHOOK_PORT=3000
LOG_LEVEL=info
NODE_ENV=development
```

---

### 3. Setup Database

```bash
npm run db:setup
```

**What this does**:
- Creates `users` table
- Creates `user_subscriptions` table
- Creates `user_usage` table
- Creates `user_module_config` table
- Adds indexes and views
- Seeds test user

**Expected output**:
```
✓ Database connected
✓ Schema executed successfully
✓ users
✓ user_subscriptions
✓ user_usage
✓ user_module_config

Test user created:
  Email: test@example.com
  License Key: test-license-key-12345
```

**Verify**:
```bash
npm run admin:health
```

Should show all green checks.

---

### 4. Create Stripe Products

```bash
npm run stripe:setup
```

**What this does**:
- Reads pricing from `src/config/pricing.ts`
- Creates 4 products in Stripe:
  - VPA Core Only ($30/month)
  - VPA + ProspectFinder ($80/month)
  - VPA + Email ($55/month)
  - VPA Complete Bundle ($99/month)
- Creates monthly recurring prices

**Save the output!** You need the Price IDs.

Example output:
```
✅ VPA Core Only
   Product ID: prod_ABC123
   Price ID:   price_1234567890  ← SAVE THIS
   Amount:     $30/month

✅ VPA Complete Bundle
   Product ID: prod_XYZ789
   Price ID:   price_0987654321  ← SAVE THIS
   Amount:     $99/month
```

**Create a note file**:
```bash
echo "VPA Core Only: price_1234567890" > stripe-prices.txt
echo "VPA Bundle: price_0987654321" >> stripe-prices.txt
```

---

### 5. Setup Webhook Forwarding (Local Development)

**Option A: Stripe CLI (Recommended)**

Install Stripe CLI:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (with Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.0/stripe_1.19.0_linux_x86_64.tar.gz
tar -xvf stripe_1.19.0_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

Login to Stripe:
```bash
stripe login
```

Start webhook server (Terminal 1):
```bash
npm run webhook:server
```

Forward webhooks (Terminal 2):
```bash
stripe listen --forward-to localhost:3000/webhook
```

**Copy the webhook secret** from Terminal 2:
```
> Ready! Your webhook signing secret is whsec_abc123...
```

Add to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

Restart webhook server (Ctrl+C in Terminal 1, then):
```bash
npm run webhook:server
```

**Option B: ngrok (Alternative)**

```bash
# Install ngrok
npm install -g ngrok

# Start webhook server
npm run webhook:server

# Expose (Terminal 2)
ngrok http 3000
```

Use ngrok URL to configure webhook in Stripe Dashboard.

---

### 6. Test the Installation

**Create test checkout link**:

```bash
npm run stripe:checkout
```

Follow prompts:
1. Select plan: `4` (VPA Complete Bundle)
2. Email: `test-checkout@example.com`
3. Trial: `7` days
4. Price ID: `price_0987654321` (from Step 4)

**Open checkout URL** in browser.

**Complete payment**:
- Card: `4242 4242 4242 4242`
- Expiry: `12/25`
- CVC: `123`
- ZIP: `12345`

**Verify user created**:
```bash
npm run admin:list-users
```

Should show `test-checkout@example.com` with:
- License key (VPA-XXXX-XXXX-XXXX-XXXX)
- Active subscription
- Trial end date (7 days from now)
- Modules: All 4 modules

**Check webhook logs** (Terminal 1):
```
INFO: Webhook event received type=checkout.session.completed
INFO: Created new user from Stripe checkout
INFO: User subscription created/updated from checkout
```

---

## Verify Installation

Run all verification checks:

```bash
# 1. Database health
npm run admin:health

# 2. List users
npm run admin:list-users

# 3. Check subscriptions
npm run admin:manage-subs

# 4. Webhook server health
curl http://localhost:3000/health
```

**All should return success!**

---

## Common Installation Issues

### Issue: "DATABASE_URL not set"

**Solution**: Add `DATABASE_URL` to `.env` file

### Issue: "STRIPE_SECRET_KEY is required"

**Solution**: Add Stripe keys to `.env` file (get from Stripe Dashboard)

### Issue: "npm ERR! peer dependency conflict"

**Solution**:
```bash
npm install --legacy-peer-deps
```

### Issue: "Webhook signature verification failed"

**Solution**: Ensure `STRIPE_WEBHOOK_SECRET` in `.env` matches output from `stripe listen`

### Issue: "Database connection failed"

**Solution**:
1. Verify database is running
2. Check `DATABASE_URL` format
3. Test connection: `psql $DATABASE_URL`

### Issue: "Port 3000 already in use"

**Solution**: Change `WEBHOOK_PORT` in `.env` to different port (e.g., `3001`)

---

## Directory Structure

After installation:

```
vpa-core/
├── src/
│   ├── billing/              ← Stripe integration
│   │   ├── stripe-client.ts
│   │   ├── create-checkout.ts
│   │   ├── create-portal.ts
│   │   ├── webhook-server.ts
│   │   ├── webhook-handlers.ts
│   │   └── README.md
│   ├── config/
│   │   └── pricing.ts        ← Pricing plans
│   ├── db/
│   │   ├── client.ts
│   │   ├── helpers.ts
│   │   └── schema.sql
│   └── ...
├── scripts/
│   ├── stripe/               ← Stripe utilities
│   │   ├── setup-products.ts
│   │   └── create-checkout-link.ts
│   └── admin/
├── .env                      ← Your configuration
├── package.json
└── Documentation files...
```

---

## Next Steps

1. ✅ Installation complete
2. ✅ Test checkout flow works
3. 📖 Read `STRIPE_QUICKSTART.md` for quick reference
4. 📖 Read `STRIPE_SETUP.md` for production deployment
5. 📖 Read `STRIPE_TESTING.md` for test scenarios
6. 🚀 When ready, deploy to production

---

## Quick Reference Commands

```bash
# Development
npm run dev                    # Start VPA Core
npm run webhook:server         # Start webhook server

# Stripe
npm run stripe:setup           # Create Stripe products
npm run stripe:checkout        # Generate checkout link

# Database
npm run db:setup               # Initialize database
npm run admin:list-users       # View users
npm run admin:health           # Health check

# Testing
stripe listen --forward-to localhost:3000/webhook
stripe trigger checkout.session.completed
stripe dashboard               # Open Stripe Dashboard
```

---

## Uninstallation

To completely remove VPA Core:

```bash
# 1. Stop webhook server
# Ctrl+C in terminal

# 2. Drop database tables (CAREFUL!)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Remove Stripe products
# Do manually in Stripe Dashboard > Products

# 4. Delete directory
cd ..
rm -rf vpa-core
```

---

## Getting Help

- **Installation issues**: Check this file
- **Stripe configuration**: See `STRIPE_SETUP.md`
- **Testing**: See `STRIPE_TESTING.md`
- **Billing module**: See `src/billing/README.md`
- **Stripe support**: [support.stripe.com](https://support.stripe.com)

---

**Installation complete! You're ready to build AI-runnable businesses with VPA Core. 🚀**
