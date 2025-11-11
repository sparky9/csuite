# VPA Admin Tools - Quick Reference

Professional admin CLI tools for managing VPA Core users and subscriptions.

---

## Quick Commands

```bash
# Create new user with license key
npm run admin:create-user

# Add/remove modules from user
npm run admin:grant-modules

# View usage analytics
npm run admin:view-usage

# Manage subscriptions
npm run admin:manage-subs

# List all users
npm run admin:list-users

# System health check
npm run admin:health
```

---

## File Structure

```
vpa-core/scripts/admin/
├── utils.ts                    # Shared utilities (prompts, formatting)
├── create-user.ts              # Create new users
├── grant-modules.ts            # Add/remove modules
├── view-usage.ts               # Analytics dashboard
├── manage-subscriptions.ts     # Subscription management
├── list-users.ts               # User listings and exports
├── health-check.ts             # System diagnostics
└── README.md                   # This file
```

---

## Tool Overview

### 1. Create User (`create-user.ts`)
- Interactive user creation
- Auto-generates license keys
- Sets up subscription and trial
- **Use for:** Onboarding new customers

### 2. Grant Modules (`grant-modules.ts`)
- Add/remove modules from users
- Automatic price calculation
- Module-level access control
- **Use for:** Upgrading/downgrading plans

### 3. View Usage (`view-usage.ts`)
- User activity analytics
- Module usage breakdown
- Error tracking
- CSV export
- **Use for:** Monitoring engagement

### 4. Manage Subscriptions (`manage-subscriptions.ts`)
- Change plans
- Update status (active/trialing/cancelled)
- Extend trials and periods
- **Use for:** Billing and trial management

### 5. List Users (`list-users.ts`)
- View all users
- Filter by status
- Sort by usage
- Export to CSV
- **Use for:** Reporting and analysis

### 6. Health Check (`health-check.ts`)
- Database connectivity
- Table integrity
- Data validation
- System statistics
- **Use for:** Daily monitoring

---

## Common Workflows

### New Customer Onboarding
```bash
npm run admin:create-user
# Enter: email, name, plan, trial days
# Copy license key → send to customer
```

### Upgrade Customer Plan
```bash
npm run admin:grant-modules
# Enter: email
# Select: Add modules
# Confirm: Price change
```

### Monthly Reporting
```bash
npm run admin:list-users
# Select: All users (view MRR)

npm run admin:view-usage
# Select: All users summary

# Optional: Export to CSV
```

### Handle Failed Payment
```bash
npm run admin:manage-subs
# Enter: email
# Select: Update status → past_due
# Contact customer
# Later: Update status → active
```

---

## Pricing Plans

| Plan ID | Name | Price | Modules |
|---------|------|-------|---------|
| `vpa-core-only` | CRM Starter | $30/mo | vpa-core, lead-tracker |
| `vpa-plus-prospects` | Growth Plan | $80/mo | + prospect-finder |
| `vpa-plus-email` | Outreach Plan | $55/mo | + email-orchestrator |
| `vpa-bundle` | Complete Suite | $99/mo | All modules ⭐ |

**Module Pricing (à la carte):**
- `prospect-finder`: +$50/month
- `email-orchestrator`: +$25/month

---

## Subscription Statuses

- **active**: Paying customer, full access
- **trialing**: In trial period, full access
- **past_due**: Payment failed, may restrict
- **cancelled**: No access, subscription ended

---

## Error Handling

All tools include:
- Input validation
- Database transaction safety (ROLLBACK on error)
- Clear error messages
- Logging to `logs/vpa-error.log`

---

## Security Features

- Email validation
- Auto-generated secure license keys
- Transaction safety (BEGIN/COMMIT/ROLLBACK)
- Admin action logging
- Confirmation prompts for destructive actions

---

## For Full Documentation

See: [ADMIN_GUIDE.md](../../ADMIN_GUIDE.md)

Comprehensive guide with:
- Detailed tool instructions
- Troubleshooting
- Best practices
- Example outputs

---

## Requirements

- Node.js 18+
- PostgreSQL database
- DATABASE_URL configured in .env
- Dependencies installed: `npm install`

---

## Development

All tools use shared utilities from `utils.ts`:

```typescript
import {
  prompt,           // Get user input
  promptNumber,     // Get number with validation
  confirm,          // Yes/no confirmation
  formatCurrency,   // Cents to $X.XX
  formatDate,       // Pretty dates
  header,           // Section headers
  success,          // ✅ messages
  error,            // ❌ messages
  divider,          // Visual separators
  printTable,       // Formatted tables
  exportToCsv       // CSV generation
} from './utils.js';
```

---

**Built with elegance by Forge for Mike's VPA Core**
