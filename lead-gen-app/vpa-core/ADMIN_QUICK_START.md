# VPA Admin Tools - Quick Start Guide

**Get started in 5 minutes!**

---

## Installation (One Time)

```bash
cd vpa-core

# 1. Install dependencies
npm install

# 2. Set up database
npm run db:setup

# 3. Test system
npm run admin:health
```

**Expected:** All green checkmarks ✓

---

## Daily Usage

### Create New Customer

```bash
npm run admin:create-user
```

**You'll be prompted for:**
1. Email address
2. Customer name
3. Pricing plan (recommend plan 4 - Complete Bundle)
4. Trial days (recommend 14)

**You'll get:**
- License key (VPA-XXXX-XXXX-XXXX-XXXX)
- Copy this and send to customer

---

### View All Customers

```bash
npm run admin:list-users
```

**Select:** Option 1 (All users)

**You'll see:**
- Total customers
- Active vs trialing
- Monthly Recurring Revenue (MRR)

---

### Check System Health

```bash
npm run admin:health
```

**Run this daily to:**
- Verify database is healthy
- Check for data issues
- Monitor user counts and MRR

---

## Common Tasks

### Upgrade a Customer

```bash
npm run admin:grant-modules
```

1. Enter customer email
2. Select "Add modules"
3. Choose which modules to add
4. Confirm price change

---

### Extend Trial Period

```bash
npm run admin:manage-subs
```

1. Enter customer email
2. Select "Extend/modify trial"
3. Enter new trial length (days)
4. Confirm

---

### View Usage Stats

```bash
npm run admin:view-usage
```

**Options:**
- Option 1: Overview of all users
- Option 2: Specific user details
- Option 5: Export to CSV

---

### Export Customer List

```bash
npm run admin:list-users
```

**Select:** Option 6 (Export to CSV)

Gets you a spreadsheet with all customer data.

---

## Pricing Plans

| Plan | Price | Best For |
|------|-------|----------|
| CRM Starter | $30/mo | Basic CRM only |
| Growth Plan | $80/mo | CRM + Prospecting |
| Outreach Plan | $55/mo | CRM + Email |
| **Complete Bundle** ⭐ | **$99/mo** | **Everything (RECOMMENDED)** |

---

## Key Commands Cheat Sheet

```bash
# Master menu (choose a tool)
npm run admin

# Specific tools
npm run admin:create-user      # Onboard customers
npm run admin:grant-modules    # Change modules
npm run admin:view-usage       # See activity
npm run admin:manage-subs      # Manage billing
npm run admin:list-users       # View customers
npm run admin:health           # Check system
```

---

## Workflow: Onboarding New Customer

1. **Create account:**
   ```bash
   npm run admin:create-user
   ```

2. **Copy license key** (shown after creation)

3. **Send to customer:**
   ```
   Hi [Name],

   Welcome to VPA! Here's your license key:

   VPA-XXXX-XXXX-XXXX-XXXX

   You have 14 days to try all features.
   Setup instructions: [link]

   Questions? Just reply!
   ```

4. **Done!** Customer can now use VPA.

---

## Workflow: Monthly Reporting

1. **Get customer count & MRR:**
   ```bash
   npm run admin:list-users
   # Select: Option 1
   ```

2. **Get usage stats:**
   ```bash
   npm run admin:view-usage
   # Select: Option 1
   ```

3. **Export data (optional):**
   ```bash
   npm run admin:list-users
   # Select: Option 6 (Export CSV)
   ```

4. **Review:**
   - Total MRR
   - Active vs trialing customers
   - Usage trends

---

## Workflow: Customer Wants to Upgrade

**Customer:** "I want to add prospect finding"

1. **Run:**
   ```bash
   npm run admin:grant-modules
   ```

2. **Enter:** Customer email

3. **Select:** Add modules → prospect-finder

4. **Confirm:** New price shown

5. **Tell customer:** "Done! Price is now $X/month"

---

## Workflow: Trial Ending Soon

**Customer:** "Can I get more trial time?"

1. **Run:**
   ```bash
   npm run admin:manage-subs
   ```

2. **Enter:** Customer email

3. **Select:** Extend/modify trial

4. **Enter:** New trial length (e.g., 21 days)

5. **Tell customer:** "Extended to [date]"

---

## Troubleshooting

### Can't connect to database

```bash
# Check .env file exists
cat .env

# Should show:
# DATABASE_URL=postgresql://...
```

### User not found

```bash
# List all users to check email
npm run admin:list-users
# Select: Option 1
```

### Something else broken

```bash
# Check system health
npm run admin:health

# If errors, check logs
cat logs/vpa-error.log
```

---

## Need More Help?

📖 **Full Manual:** See `ADMIN_GUIDE.md` (comprehensive)

📋 **Testing Guide:** See `ADMIN_DEPLOYMENT_CHECKLIST.md`

🏗️ **Architecture:** See `scripts/admin/ARCHITECTURE.md`

---

## Best Practices

✅ **DO:**
- Run health check daily
- Always use 14-day trials for new customers
- Recommend Complete Bundle (best value)
- Send license keys via secure channel
- Keep license keys private

❌ **DON'T:**
- Don't create users without verifying email
- Don't skip trial periods
- Don't share license keys publicly
- Don't forget to send license key to customer

---

## Quick Stats Reference

**View anytime:**

```bash
npm run admin:health
```

Shows:
- Total users
- Active subscriptions
- MRR (Monthly Recurring Revenue)
- Recent activity
- System health

---

**That's it! You're ready to manage VPA customers.**

Questions? Check `ADMIN_GUIDE.md` for detailed instructions.

---

**Built with elegance by Forge** 🔥
