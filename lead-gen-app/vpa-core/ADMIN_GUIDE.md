# VPA Core - Admin Tools Guide

Complete guide for managing VPA Core users, subscriptions, and system health using the admin CLI tools.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Tools](#available-tools)
3. [Tool Details](#tool-details)
   - [Create User](#1-create-user)
   - [Grant Modules](#2-grant-modules)
   - [View Usage](#3-view-usage)
   - [Manage Subscriptions](#4-manage-subscriptions)
   - [List Users](#5-list-users)
   - [Health Check](#6-health-check)
4. [Common Workflows](#common-workflows)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## Quick Start

All admin tools are run via npm scripts from the `vpa-core` directory:

```bash
cd vpa-core

# Create a new user
npm run admin:create-user

# View all users
npm run admin:list-users

# Check system health
npm run admin:health
```

**Requirements:**
- Node.js 18+
- PostgreSQL database configured (DATABASE_URL in .env)
- vpa-core dependencies installed (`npm install`)

---

## Available Tools

| Command | Purpose | Use Case |
|---------|---------|----------|
| `npm run admin:create-user` | Create new users with license keys | Onboarding new customers |
| `npm run admin:grant-modules` | Add/remove modules from users | Upgrading/downgrading plans |
| `npm run admin:view-usage` | Analytics and usage statistics | Monitoring user activity |
| `npm run admin:manage-subs` | Update subscriptions and billing | Managing trials, status, periods |
| `npm run admin:list-users` | View and export user lists | Reviewing customers, exporting data |
| `npm run admin:health` | System health diagnostics | Monitoring system status |

---

## Tool Details

### 1. Create User

**Command:** `npm run admin:create-user`

**Purpose:** Create new customer accounts with license keys and subscriptions.

**Interactive Workflow:**

```
VPA Admin - Create New User

Email: john@example.com
Name: John Doe

Available Plans:
  [1] CRM Starter - $30.00/month
      Modules: vpa-core, lead-tracker

  [2] Growth Plan - $80.00/month ⭐ RECOMMENDED
      Modules: vpa-core, lead-tracker, prospect-finder
      Limits: 5000 prospects/mo

  [3] Outreach Plan - $55.00/month
      Modules: vpa-core, lead-tracker, email-orchestrator
      Limits: 20 campaigns/mo, 10000 emails/mo

  [4] Complete Suite - $99.00/month ⭐ RECOMMENDED
      Modules: vpa-core, lead-tracker, prospect-finder, email-orchestrator
      Limits: 10000 prospects/mo, 50 campaigns/mo, 25000 emails/mo

Select plan (1-4): 4
Trial days (0 for no trial): 14

Review Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:        john@example.com
Name:         John Doe
License Key:  VPA-XY7F-9K2L-4M3N-8P1Q
Plan:         Complete Suite
Price:        $99.00/month
Modules:      vpa-core, lead-tracker, prospect-finder, email-orchestrator
Trial ends:   Nov 3, 2024
Period ends:  Dec 4, 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create this user? (y/n): y

✅ User created successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email:        john@example.com
👤 Name:         John Doe
🔑 License Key:  VPA-XY7F-9K2L-4M3N-8P1Q
📦 Plan:         Complete Suite
💰 Price:        $99.00/month
🧩 Modules:      vpa-core, lead-tracker, prospect-finder, email-orchestrator
⏰ Trial ends:   Nov 3, 2024
📅 Period ends:  Dec 4, 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 Send the license key to the customer for VPA setup
```

**What It Does:**
- Validates email format and checks for duplicates
- Generates secure license key automatically
- Creates user record in database
- Creates subscription with selected plan
- Handles trial periods
- Provides license key for customer

**Tips:**
- License keys are auto-generated (format: VPA-XXXX-XXXX-XXXX-XXXX)
- Trial period is optional (enter 0 for no trial)
- Review summary before confirming
- Copy license key to send to customer

---

### 2. Grant Modules

**Command:** `npm run admin:grant-modules`

**Purpose:** Add or remove modules from existing users (upgrade/downgrade plans).

**Interactive Workflow:**

```
VPA Admin - Grant/Revoke Modules

User email: john@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: John Doe (john@example.com)
Current Plan: vpa-core-only
Current Price: $30.00/month
Current Modules: vpa-core, lead-tracker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Actions:
  [1] Add modules
  [2] Remove modules
  [3] Cancel

Select action: 1

Available modules to add:
  [1] prospect-finder (+$50.00/month)
  [2] email-orchestrator (+$25.00/month)

Select modules to add (comma-separated numbers, or "all"): 1,2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Changes:
  Old modules: vpa-core, lead-tracker
  New modules: vpa-core, lead-tracker, prospect-finder, email-orchestrator
  Old price: $30.00/month
  New price: $105.00/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply these changes? (y/n): y

✅ Modules updated successfully!

✅ New modules: vpa-core, lead-tracker, prospect-finder, email-orchestrator
💰 New price: $105.00/month
```

**What It Does:**
- Shows current modules and pricing
- Allows adding or removing modules
- Calculates new pricing automatically
- Updates subscription in database
- Cannot remove core modules (vpa-core)

**Module Pricing:**
- `vpa-core`: Included in base
- `lead-tracker`: Included in base
- `prospect-finder`: +$50/month
- `email-orchestrator`: +$25/month

**Tips:**
- Use "all" to add all available modules at once
- Core modules cannot be removed
- Price updates immediately
- Consider suggesting bundle plans for better value

---

### 3. View Usage

**Command:** `npm run admin:view-usage`

**Purpose:** Analytics dashboard for user activity, module usage, and error tracking.

**Options:**

```
VPA Admin - Usage Analytics

Options:
  [1] All users summary
  [2] Specific user details
  [3] Module usage breakdown
  [4] Last 24 hours activity
  [5] Export to CSV

Select option: 1
```

#### Option 1: All Users Summary

```
All Users Summary - Last 30 Days

Total Commands:    1,247
Active Users:      23
Failed Commands:   29 (2.3%)
Avg Execution:     156ms

Top 10 Users by Activity:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email                      | Name           | Commands | Errors | % of Total
──────────────────────────────────────────────────────────────────────────────
john@example.com           | John Doe       | 156      | 2      | 12.5%
jane@example.com           | Jane Smith     | 142      | 0      | 11.4%
...

Module Usage Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Module                     | Commands | Errors | % of Total
──────────────────────────────────────────────────────────────────────────────
lead-tracker               | 562      | 8      | 45.0%
prospect-finder            | 421      | 15     | 33.8%
email-orchestrator         | 264      | 6      | 21.2%
```

#### Option 2: Specific User Details

```
User email: john@example.com

Usage Details: John Doe (john@example.com)

Total Commands:    156
Failed Commands:   2 (1.3%)
Avg Execution:     142ms
First Activity:    Oct 1, 2024 (19 days ago)
Last Activity:     Oct 20, 2024 (Today)

Module Usage:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Module                     | Commands | Errors | Avg Time
──────────────────────────────────────────────────────────────────────────────
lead-tracker               | 89       | 0      | 128ms
prospect-finder            | 45       | 2      | 165ms
email-orchestrator         | 22       | 0      | 134ms

Recent Activity (Last 20):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Module               | Tool              | Status | Time          | Duration
──────────────────────────────────────────────────────────────────────────────
lead-tracker         | add_prospect      | ✓      | 2 hours ago   | 145ms
prospect-finder      | search_companies  | ✓      | 3 hours ago   | 234ms
...
```

#### Option 3: Module Usage Breakdown

Shows detailed breakdown by module and tool name with usage counts.

#### Option 4: Last 24 Hours Activity

Real-time monitoring of recent activity with hourly breakdown.

#### Option 5: Export to CSV

Exports full usage data to CSV file for analysis in Excel/Sheets.

**What It Does:**
- Track user activity across all modules
- Identify power users and inactive users
- Monitor error rates and performance
- Export data for external analysis

**Use Cases:**
- Monitor customer engagement
- Identify users who might churn (low usage)
- Track module adoption rates
- Find performance issues

---

### 4. Manage Subscriptions

**Command:** `npm run admin:manage-subs`

**Purpose:** Update subscription status, plans, billing periods, and trials.

**Interactive Workflow:**

```
VPA Admin - Manage Subscriptions

User email: john@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: John Doe (john@example.com)
User Status: active

Plan: VPA Complete Bundle
Price: $99.00/month
Status: trialing
Modules: vpa-core, lead-tracker, prospect-finder, email-orchestrator
Trial ends: Nov 3, 2024
Period: Oct 20, 2024 → Nov 20, 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Actions:
  [1] Change plan
  [2] Extend period
  [3] Update status
  [4] Extend/modify trial
  [5] Cancel

Select action: 4

Current trial ends: Nov 3, 2024
Set trial for how many days from now? 21

New trial end: Nov 10, 2024

Apply trial extension? (y/n): y

✅ Trial set to 21 days!
```

**Actions Available:**

#### 1. Change Plan
- Switch user to different pricing plan
- Updates modules and pricing automatically
- Useful for upgrades/downgrades

#### 2. Extend Period
- Add days to current billing period
- Useful for giving free time/credits
- Automatically calculates new end date

#### 3. Update Status
- Set status: active, trialing, past_due, cancelled
- Cancelling also updates user status
- Reactivating restores user access

#### 4. Extend/Modify Trial
- Add or remove trial period
- Set trial for X days from now
- Set to 0 to remove trial and make active

**Status Options:**
- `active`: Paying customer with full access
- `trialing`: In trial period, full access
- `past_due`: Payment failed, may have limited access
- `cancelled`: Subscription terminated, no access

**Use Cases:**
- Give customer extra trial time
- Handle failed payments (mark past_due)
- Manually cancel subscriptions
- Extend billing periods as goodwill gesture

---

### 5. List Users

**Command:** `npm run admin:list-users`

**Purpose:** View and filter all users, export customer lists.

**Options:**

```
VPA Admin - List Users

Options:
  [1] All users
  [2] Active users only
  [3] Trialing users
  [4] Cancelled users
  [5] Users by usage (sorted)
  [6] Export to CSV

Select option: 1
```

#### Option 1: All Users

```
VPA Users (Total: 23)

Email                      | Name           | Plan          | Status   | Modules | Usage | Created
──────────────────────────────────────────────────────────────────────────────────────────────────
john@example.com           | John Doe       | vpa-bundle    | active   | 4       | 156   | 19 days ago
jane@example.com           | Jane Smith     | vpa-plus-pro... | trialing | 3       | 142   | 5 days ago
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Users:     23
Active:          18
Trialing:        5
Total MRR:       $2,340.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Option 3: Trialing Users

Shows users currently in trial with days remaining - useful for follow-up.

```
Trialing Users (5)

Email                      | Name           | Plan          | Trial Ends   | Days Left | Signed Up
──────────────────────────────────────────────────────────────────────────────────────────────────
jane@example.com           | Jane Smith     | vpa-bundle    | Oct 25, 2024 | 5         | 5 days ago
bob@example.com            | Bob Johnson    | vpa-plus-pro... | Oct 28, 2024 | 8         | 6 days ago
...
```

#### Option 5: Users by Usage

Sorted by activity level - identify power users and inactive customers.

#### Option 6: Export to CSV

Full export including all fields:
- User ID, email, name, license key
- Subscription details
- Usage statistics
- All dates and metadata

**Use Cases:**
- Generate customer lists for marketing
- Find trials ending soon for follow-up
- Identify inactive users (churn risk)
- Export for financial reporting

---

### 6. Health Check

**Command:** `npm run admin:health`

**Purpose:** System health diagnostics and monitoring.

**Output:**

```
VPA Core - System Health Check

Running diagnostics...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Health Check Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Environment Variables   All required environment variables set
  nodeEnv: production
  logLevel: info

✓ Database Connection     Database connected successfully
  serverTime: Oct 20, 2024
  database: ep-example-12345.us-east-2.aws.neon.tech

✓ Database Tables         All required tables exist
  tableCount: 8
  tables: ["users","user_subscriptions","user_usage",...]

⚠ Data Integrity          Found 2 data integrity issue(s)
  issues: ["3 expired trials still marked as trialing","1 subscription past period end"]

✓ Usage Tracking          Usage tracking operational
  totalRecords: 1247
  uniqueUsers: 23
  last24Hours: 45
  totalErrors: 29

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
System Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Users:
  Total:      23
  Active:     18
  Suspended:  0
  Cancelled:  5

Subscriptions:
  Total:      23
  Active:     15
  Trialing:   5
  Past Due:   1
  MRR:        $2,340.00

Usage:
  Total:      1247
  Last 24h:   45
  Last 7d:    312
  Errors:     29

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Healthy:   4
⚠ Warnings:  1
✗ Errors:    0

⚠️  System has 1 warning(s). Review recommended.
```

**Checks Performed:**
1. **Environment Variables** - Required vars are set
2. **Database Connection** - Can connect and query
3. **Database Tables** - All required tables exist
4. **Data Integrity** - No orphaned records or expired subscriptions
5. **Usage Tracking** - Logging is working

**Data Integrity Warnings:**
- Users without subscriptions
- Expired trials still marked as "trialing"
- Subscriptions past period end still marked "active"

**Use Cases:**
- Daily system health monitoring
- Pre-deployment verification
- Troubleshooting issues
- Monitoring MRR and user counts

---

## Common Workflows

### Onboarding a New Customer

1. Run `npm run admin:create-user`
2. Enter customer email and name
3. Select appropriate plan (recommend Complete Bundle)
4. Set trial period (14 days recommended)
5. Copy license key
6. Send license key to customer via email
7. Customer uses license key in VPA setup

### Upgrading a Customer

**Option A: Change Entire Plan**
1. Run `npm run admin:manage-subs`
2. Enter customer email
3. Select [1] Change plan
4. Choose new plan
5. Confirm changes

**Option B: Add Specific Modules**
1. Run `npm run admin:grant-modules`
2. Enter customer email
3. Select [1] Add modules
4. Choose modules to add
5. Confirm price change

### Handling Failed Payment

1. Run `npm run admin:manage-subs`
2. Enter customer email
3. Select [3] Update status
4. Choose `past_due`
5. Contact customer about payment
6. When resolved, change status back to `active`

### Extending Trial Period

1. Run `npm run admin:manage-subs`
2. Enter customer email
3. Select [4] Extend/modify trial
4. Enter new trial duration (days from now)
5. Confirm extension

### Monthly Reporting

1. Run `npm run admin:list-users`
2. Select [1] All users to see MRR
3. Run `npm run admin:view-usage`
4. Select [1] All users summary
5. Optional: Export both to CSV for analysis

### Finding Inactive Users (Churn Risk)

1. Run `npm run admin:list-users`
2. Select [5] Users by usage
3. Look for low usage counts
4. Reach out to engage inactive users

---

## Troubleshooting

### Database Connection Errors

**Error:** `DATABASE_URL environment variable is not set`

**Solution:**
```bash
# Check .env file exists in vpa-core directory
cd vpa-core
cat .env

# Should contain:
DATABASE_URL=postgresql://user:password@host/database
```

**Error:** `Database connection failed`

**Solution:**
- Verify database is running
- Check DATABASE_URL is correct
- Test connection: `npm run admin:health`

### User Not Found

**Error:** User not found when entering email

**Solution:**
- Check email spelling (case-sensitive)
- List all users: `npm run admin:list-users`
- Verify user exists in database

### Transaction Errors

**Error:** Transaction rolled back

**Solution:**
- Check database constraints (foreign keys)
- Verify data integrity: `npm run admin:health`
- Review error message for specific issue

### Export Fails

**Error:** Cannot write CSV file

**Solution:**
- Check write permissions in current directory
- Ensure disk space available
- Run from vpa-core directory

---

## Best Practices

### User Management

1. **Always use trial periods for new customers**
   - Recommended: 14 days
   - Gives customers time to evaluate
   - Higher conversion rate

2. **Recommend Complete Bundle**
   - Best value for customers
   - Highest MRR per customer
   - Full feature access

3. **Verify email before creating user**
   - Check for typos
   - Confirm customer wants account
   - Avoid duplicate accounts

### Subscription Management

1. **Document all manual changes**
   - Keep notes on why status changed
   - Track trial extensions given
   - Record customer communication

2. **Use past_due status appropriately**
   - Only for payment failures
   - Reach out to customer immediately
   - Give grace period before cancelling

3. **Handle cancellations gracefully**
   - Ask for feedback
   - Offer to pause instead of cancel
   - Make reactivation easy

### Monitoring & Analytics

1. **Run health check daily**
   - Catch data integrity issues early
   - Monitor MRR trends
   - Track error rates

2. **Review usage weekly**
   - Identify power users (upsell opportunities)
   - Find inactive users (churn risk)
   - Monitor module adoption

3. **Export data monthly**
   - Financial reporting
   - Customer analysis
   - Backup customer data

### Security

1. **Protect license keys**
   - Send via secure channel
   - Don't post in public channels
   - Regenerate if compromised

2. **Limit admin access**
   - Only trusted team members
   - Use separate admin credentials
   - Log all admin actions

3. **Regular backups**
   - Database backups daily
   - Export customer lists weekly
   - Store securely

---

## Data Fields Reference

### User Fields
- `user_id`: UUID (auto-generated)
- `email`: Customer email (unique)
- `name`: Customer name
- `license_key`: Access key (format: VPA-XXXX-XXXX-XXXX-XXXX)
- `status`: active, suspended, cancelled
- `created_at`: Signup date

### Subscription Fields
- `plan_name`: Pricing plan ID
- `modules`: Array of enabled modules
- `price_monthly`: Price in cents (9900 = $99.00)
- `status`: active, trialing, past_due, cancelled
- `trial_end`: Trial expiration date (null if no trial)
- `current_period_start`: Billing period start
- `current_period_end`: Billing period end
- `stripe_customer_id`: Stripe customer (null if manual)

### Usage Fields
- `module_id`: Which module was used
- `tool_name`: Specific tool called
- `success`: true/false
- `execution_time_ms`: Performance metric
- `timestamp`: When it occurred

---

## Support

For issues with admin tools:

1. Run health check: `npm run admin:health`
2. Check logs in `logs/vpa-error.log`
3. Verify DATABASE_URL is correct
4. Ensure all dependencies installed: `npm install`

For database schema questions, see: `vpa-core/src/db/schema.sql`

---

## Changelog

**Version 1.0.0** (October 2024)
- Initial release of admin tools
- 6 core admin commands
- CSV export functionality
- Health monitoring system

---

**Questions?** Contact Mike or check the VPA Core documentation.
