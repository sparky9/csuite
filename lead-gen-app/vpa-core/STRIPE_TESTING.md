# Stripe Integration Testing Guide

Comprehensive testing scenarios for VPA Stripe integration.

---

## Test Scenarios

### 1. New Customer Signup (Happy Path)

**Goal**: Verify complete checkout flow creates user and subscription

**Steps**:
1. Generate checkout link:
   ```bash
   npm run stripe:checkout
   ```
2. Select "VPA Complete Bundle"
3. Email: `test-customer@example.com`
4. Trial: 7 days
5. Enter the Price ID for Complete Bundle
6. Open checkout URL in browser
7. Use test card: `4242 4242 4242 4242`
8. Complete payment

**Expected Results**:
- ✅ Checkout redirects to success URL
- ✅ Webhook `checkout.session.completed` received
- ✅ User created in database with email `test-customer@example.com`
- ✅ License key generated (format: `VPA-XXXX-XXXX-XXXX-XXXX`)
- ✅ Subscription created with status `trialing`
- ✅ Subscription modules: `['vpa-core', 'lead-tracker', 'prospect-finder', 'email-orchestrator']`
- ✅ Trial ends in 7 days
- ✅ `stripe_customer_id` and `stripe_subscription_id` stored

**Verify**:
```bash
npm run admin:list-users
# Should show new user with trial subscription
```

**Cleanup**:
```sql
DELETE FROM user_subscriptions WHERE user_id IN (
  SELECT user_id FROM users WHERE email = 'test-customer@example.com'
);
DELETE FROM users WHERE email = 'test-customer@example.com';
```

---

### 2. Existing User Upgrades Plan

**Goal**: Verify existing user can change subscription plan

**Setup**:
1. Create user with "VPA Core Only" subscription
2. Cancel that subscription in Stripe Dashboard
3. Create new checkout for "VPA Complete Bundle" with same email

**Expected Results**:
- ✅ Same user record updated (not duplicated)
- ✅ Subscription updated to new plan
- ✅ Modules updated to include all bundle modules
- ✅ Price updated to $99/month

---

### 3. Payment Failure

**Goal**: Verify subscription marked as past_due when payment fails

**Steps**:
1. Create subscription with valid card
2. In Stripe Dashboard, trigger payment failure:
   - Go to subscription
   - Click "..." menu > "Update payment failure"
3. Webhook `invoice.payment_failed` sent

**Expected Results**:
- ✅ Subscription status changed to `past_due`
- ✅ User can still access VPA temporarily (grace period)
- ✅ Webhook logs show payment failure

**Recovery Test**:
1. Update payment method in Stripe (or use portal)
2. Retry payment
3. Webhook `invoice.payment_succeeded` sent

**Expected Results**:
- ✅ Subscription status changed to `active`
- ✅ Access restored

---

### 4. Subscription Cancellation

**Goal**: Verify cancellation workflow

**Steps**:
1. Create active subscription
2. Cancel via Stripe Dashboard or customer portal
3. Webhook `customer.subscription.deleted` sent

**Expected Results**:
- ✅ Subscription status changed to `cancelled`
- ✅ User status changed to `cancelled`
- ✅ Access revoked (VPA license validation fails)

---

### 5. Trial to Paid Conversion

**Goal**: Verify trial converts to active subscription

**Steps**:
1. Create subscription with 7-day trial
2. Fast-forward time in Stripe test mode (or wait for trial end)
3. First invoice payment processes
4. Webhook `invoice.payment_succeeded` sent

**Expected Results**:
- ✅ Subscription status changes from `trialing` to `active`
- ✅ `trial_end` timestamp recorded
- ✅ First payment captured
- ✅ User continues with full access

---

### 6. Subscription Renewal

**Goal**: Verify monthly renewal processes correctly

**Steps**:
1. Create subscription
2. Fast-forward to renewal date (Stripe Dashboard > Clock)
3. Invoice generated and paid
4. Webhook `invoice.payment_succeeded` sent

**Expected Results**:
- ✅ `current_period_end` updated to next month
- ✅ Subscription remains `active`
- ✅ Invoice recorded in Stripe

---

### 7. Customer Portal Access

**Goal**: Verify self-service portal works

**Steps**:
1. Create subscription
2. Get Stripe customer ID from user metadata
3. Generate portal session:
   ```typescript
   import { createCustomerPortalSession } from './src/billing/create-portal.js';
   const session = await createCustomerPortalSession({
     customerId: 'cus_...',
     returnUrl: 'http://localhost:3000/dashboard'
   });
   console.log('Portal URL:', session.url);
   ```
4. Open portal URL

**Expected Results**:
- ✅ Customer sees subscription details
- ✅ Can update payment method
- ✅ Can view invoices
- ✅ Can cancel subscription
- ✅ Cancellation triggers `customer.subscription.deleted` webhook
- ✅ Database updated correctly

---

### 8. Webhook Idempotency

**Goal**: Verify duplicate webhooks don't cause issues

**Steps**:
1. Process a `checkout.session.completed` webhook
2. Manually replay same webhook (Stripe Dashboard > Webhooks > Event > Resend)

**Expected Results**:
- ✅ Second webhook processes without error
- ✅ No duplicate users created
- ✅ Subscription not duplicated (uses `ON CONFLICT` clause)

---

### 9. Invalid Checkout Session

**Goal**: Verify error handling for incomplete checkouts

**Steps**:
1. Create checkout link
2. Abandon checkout (don't complete payment)
3. Verify no user/subscription created

**Expected Results**:
- ✅ No webhook sent (checkout not completed)
- ✅ No database records created
- ✅ Stripe session expires after 24 hours

---

### 10. Price Mismatch Handling

**Goal**: Verify system handles unknown pricing

**Setup**:
1. Create a product in Stripe with custom price (not matching VPA plans)
2. Create checkout with that price
3. Complete payment

**Expected Results**:
- ⚠️ Webhook handler logs error: "No VPA plan found matching price"
- ❌ User not created (transaction rolled back)
- 📝 Manual intervention required

---

## Stripe Test Cards

Use these for different scenarios:

### Success Cases
- **Basic success**: `4242 4242 4242 4242`
- **3D Secure required**: `4000 0025 0000 3155`

### Failure Cases
- **Generic decline**: `4000 0000 0000 0002`
- **Insufficient funds**: `4000 0000 0000 9995`
- **Lost card**: `4000 0000 0000 9987`
- **Stolen card**: `4000 0000 0000 9979`

### Special Cases
- **Charge succeeds, disputed as fraudulent**: `4000 0000 0000 0259`
- **Expired card**: Use any expired date

**All test cards**:
- CVC: Any 3 digits
- Expiry: Any future date
- ZIP: Any valid ZIP

Full list: [https://stripe.com/docs/testing](https://stripe.com/docs/testing)

---

## Testing Workflows

### Local Development Testing

```bash
# Terminal 1: Start webhook server
npm run webhook:server

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/webhook

# Terminal 3: Trigger events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### Verify Database State

```bash
# List all users
npm run admin:list-users

# View specific user
npm run admin:manage-subs

# Check database directly
psql $DATABASE_URL -c "SELECT email, status, license_key FROM users;"
psql $DATABASE_URL -c "SELECT user_id, plan_name, status FROM user_subscriptions;"
```

### Check Webhook Logs

```bash
# Application logs (from webhook server)
tail -f logs/vpa-combined.log

# Stripe webhook logs
stripe logs tail
```

---

## Edge Cases to Test

### Edge Case 1: Email Already Exists

**Scenario**: User signs up, cancels, then signs up again with same email

**Expected**: User record reused, new subscription created

### Edge Case 2: Webhook Out of Order

**Scenario**: `subscription.updated` arrives before `checkout.session.completed`

**Expected**: Update webhook silently fails (subscription not found), checkout creates it

### Edge Case 3: Metadata Corruption

**Scenario**: User metadata missing `stripe_customer_id`

**Expected**: Webhook adds it during next update

### Edge Case 4: Database Connection Failure

**Scenario**: Database unreachable when webhook received

**Expected**:
- Webhook handler throws error
- Stripe retries webhook automatically
- Eventually succeeds when database recovers

### Edge Case 5: Price Change Mid-Checkout

**Scenario**: Admin changes pricing in Stripe after checkout link created

**Expected**: Checkout uses original price (Price ID locked at creation)

---

## Automated Testing (Future Enhancement)

Create automated test suite:

```typescript
// tests/stripe-integration.test.ts
import { test, expect } from 'vitest';
import { stripe } from '../src/billing/stripe-client.js';
import { handleCheckoutCompleted } from '../src/billing/webhook-handlers.js';

test('checkout creates user and subscription', async () => {
  // Create test checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: 'price_test_xxx', quantity: 1 }],
    customer_email: 'test@example.com',
    success_url: 'http://localhost/success',
    cancel_url: 'http://localhost/cancel',
  });

  // Simulate webhook
  await handleCheckoutCompleted(session);

  // Verify database
  const user = await db.query('SELECT * FROM users WHERE email = $1', ['test@example.com']);
  expect(user.rows.length).toBe(1);
  expect(user.rows[0].status).toBe('active');
});
```

---

## Performance Testing

### Test Webhook Processing Speed

```bash
# Time webhook processing
time stripe trigger checkout.session.completed

# Expected: < 500ms for checkout.session.completed
```

### Test Concurrent Webhooks

1. Create multiple subscriptions rapidly
2. Verify all webhooks process correctly
3. Check for race conditions or deadlocks

---

## Security Testing

### Test Webhook Signature Verification

1. Send webhook without signature:
   ```bash
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -d '{"type": "checkout.session.completed"}'
   ```

   **Expected**: `400 Missing signature`

2. Send webhook with invalid signature:
   ```bash
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -H "stripe-signature: invalid" \
     -d '{"type": "checkout.session.completed"}'
   ```

   **Expected**: `400 Webhook Error: ...`

### Test SQL Injection Protection

Ensure parameterized queries prevent injection:

```typescript
// SAFE (parameterized)
db.query('SELECT * FROM users WHERE email = $1', [userInput]);

// UNSAFE (never do this)
db.query(`SELECT * FROM users WHERE email = '${userInput}'`);
```

VPA Core uses parameterized queries throughout - verify no string concatenation in SQL.

---

## Production Launch Checklist

Before going live:

- [ ] All happy path tests pass
- [ ] All failure cases handled gracefully
- [ ] Webhook signature verification working
- [ ] Database transactions prevent corruption
- [ ] Error logging comprehensive
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
- [ ] Customer support trained on portal usage
- [ ] Refund process documented
- [ ] Cancellation flow tested end-to-end

---

## Monitoring in Production

### Key Metrics

- **Webhook success rate**: Should be >99%
- **Checkout conversion**: Track abandoned vs completed
- **Payment failure rate**: Monitor for patterns
- **Database sync accuracy**: Stripe vs VPA database matches

### Alerts to Configure

- Failed webhook processing (5+ in 10 minutes)
- Database connection errors
- Stripe API errors
- Subscription creation failures
- Payment failures exceeding threshold

---

## Troubleshooting Test Failures

### "License key not generated"

**Check**: User creation in webhook handler
**Fix**: Verify `generateLicenseKey()` function works

### "Subscription not found"

**Check**: Webhook order (checkout completed first?)
**Fix**: Ensure `checkout.session.completed` processes before updates

### "Database deadlock"

**Check**: Concurrent webhooks for same user
**Fix**: Add proper transaction isolation or locking

### "Stripe API rate limit"

**Check**: Too many test requests
**Fix**: Use test mode quotas, add retry logic with backoff

---

## Next Steps After Testing

1. ✅ Complete all test scenarios
2. ✅ Fix any issues found
3. ✅ Document edge cases encountered
4. 🚀 Deploy to production
5. 📊 Monitor first 50 real transactions closely
6. 📧 Send welcome emails (implement TODO in webhook handlers)
7. 🔄 Implement automated testing suite (optional)

---

**Ready for production?** Ensure all tests pass, then proceed with confidence! 🎉
