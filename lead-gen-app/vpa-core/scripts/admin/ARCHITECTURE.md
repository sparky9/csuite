# VPA Admin Tools - Technical Architecture

Visual diagrams and technical specifications for the admin tool system.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPA ADMIN CLI                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ npm run      │  │ npm run      │  │ npm run      │         │
│  │ admin        │  │ admin:       │  │ admin:       │         │
│  │              │  │ create-user  │  │ list-users   │  ...    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │              Admin Tools Layer                           │  │
│  │                                                           │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │ Create     │ │ Grant      │ │ View       │           │  │
│  │  │ User       │ │ Modules    │ │ Usage      │           │  │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘           │  │
│  │        │              │              │                   │  │
│  │  ┌─────┴──────┐ ┌─────┴──────┐ ┌─────┴──────┐           │  │
│  │  │ Manage     │ │ List       │ │ Health     │           │  │
│  │  │ Subs       │ │ Users      │ │ Check      │           │  │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘           │  │
│  │        │              │              │                   │  │
│  │        └──────────────┼──────────────┘                   │  │
│  │                       │                                  │  │
│  └───────────────────────┼──────────────────────────────────┘  │
│                          │                                     │
│  ┌───────────────────────▼──────────────────────────────────┐  │
│  │              Shared Utilities Layer                      │  │
│  │                                                           │  │
│  │  • prompt()          • formatCurrency()                  │  │
│  │  • promptNumber()    • formatDate()                      │  │
│  │  • confirm()         • printTable()                      │  │
│  │  • header()          • exportToCsv()                     │  │
│  │  • success/error()   • divider()                         │  │
│  │                                                           │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│                │  │             │  │                 │
│  DB Client     │  │  Pricing    │  │  Logger         │
│  (PostgreSQL)  │  │  Config     │  │  (Winston)      │
│                │  │             │  │                 │
│  • query()     │  │  • PRICING  │  │  • info()       │
│  • connect()   │  │    _PLANS   │  │  • error()      │
│  • disconnect()│  │             │  │  • debug()      │
│                │  │             │  │                 │
└───────┬────────┘  └─────────────┘  └────────┬────────┘
        │                                     │
        │                                     │
┌───────▼──────────────────────────────────────▼────────┐
│                                                        │
│                 PostgreSQL Database                    │
│                                                        │
│  ┌────────┐  ┌──────────────────┐  ┌────────────┐   │
│  │ users  │  │ user_             │  │ user_      │   │
│  │        │  │ subscriptions    │  │ usage      │   │
│  └────────┘  └──────────────────┘  └────────────┘   │
│                                                        │
│  ┌──────────────────┐  ┌────────────────────────┐    │
│  │ user_module_     │  │ Other module tables    │    │
│  │ config           │  │ (prospects, etc.)      │    │
│  └──────────────────┘  └────────────────────────┘    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Create User Flow

```
User Input
    │
    ├─→ Email
    ├─→ Name
    ├─→ Plan Selection
    └─→ Trial Days
         │
         ▼
    Validation
         │
         ├─→ Email format check
         ├─→ Email uniqueness check
         └─→ Plan exists check
              │
              ▼
    Generate License Key
         │
         ├─→ Random segments (4x)
         └─→ Format: VPA-XXXX-XXXX-XXXX-XXXX
              │
              ▼
    Database Transaction
         │
         ├─→ BEGIN
         ├─→ INSERT users
         ├─→ INSERT user_subscriptions
         ├─→ COMMIT
         │
         ▼
    Success Output
         │
         └─→ Display license key
             └─→ Log admin action
```

### Grant Modules Flow

```
User Input
    │
    └─→ Email
         │
         ▼
    Find User & Subscription
         │
         ├─→ Query users table
         └─→ Query user_subscriptions
              │
              ▼
    Show Current State
         │
         ├─→ Current modules
         ├─→ Current price
         └─→ Available options
              │
              ▼
    Select Action
         │
         ├─→ Add modules
         │    │
         │    ├─→ Show available
         │    ├─→ Select modules
         │    └─→ Calculate new price
         │
         └─→ Remove modules
              │
              ├─→ Show removable
              ├─→ Select modules
              └─→ Calculate new price
                   │
                   ▼
    Confirm Changes
         │
         ├─→ Show diff
         └─→ Yes/No prompt
              │
              ▼
    Update Database
         │
         ├─→ UPDATE user_subscriptions
         │    ├─→ modules = [new array]
         │    └─→ price_monthly = new_price
         │
         └─→ Log admin action
```

### View Usage Flow

```
Select Analysis Type
    │
    ├─→ All Users Summary
    │    │
    │    ├─→ Aggregate total commands
    │    ├─→ Count active users
    │    ├─→ Calculate error rate
    │    ├─→ Top 10 users by activity
    │    └─→ Module breakdown
    │
    ├─→ Specific User
    │    │
    │    ├─→ Find user by email
    │    ├─→ Total commands
    │    ├─→ Module usage breakdown
    │    └─→ Recent activity (last 20)
    │
    ├─→ Module Breakdown
    │    │
    │    ├─→ Group by module_id
    │    ├─→ Group by tool_name
    │    └─→ Show usage counts
    │
    ├─→ Last 24 Hours
    │    │
    │    ├─→ Recent activity stats
    │    └─→ Hourly breakdown
    │
    └─→ Export to CSV
         │
         ├─→ Query all usage data
         ├─→ Format as CSV
         └─→ Write to file
```

---

## Database Schema Integration

### Tables Used by Admin Tools

```sql
-- Primary Tables
users
├─ user_id (PK)
├─ email (UNIQUE)
├─ name
├─ license_key (UNIQUE, AUTO-GENERATED)
├─ status (active|suspended|cancelled)
└─ created_at

user_subscriptions
├─ subscription_id (PK)
├─ user_id (FK → users.user_id)
├─ plan_name
├─ modules (ARRAY)
├─ price_monthly (INTEGER, cents)
├─ status (active|trialing|past_due|cancelled)
├─ trial_end
├─ current_period_start
├─ current_period_end
└─ updated_at

user_usage
├─ usage_id (PK)
├─ user_id (FK → users.user_id)
├─ module_id
├─ tool_name
├─ success (BOOLEAN)
├─ execution_time_ms
└─ timestamp

user_module_config
├─ config_id (PK)
├─ user_id (FK → users.user_id)
├─ module_id
├─ config_key
└─ config_value (JSONB)
```

### Key Relationships

```
users (1) ──< user_subscriptions (N)
users (1) ──< user_usage (N)
users (1) ──< user_module_config (N)
```

---

## Module Architecture

### Pricing Integration

```typescript
// Config
PRICING_PLANS = [
  {
    id: 'vpa-core-only',
    displayName: 'CRM Starter',
    priceMonthly: 3000,  // cents
    modules: ['vpa-core', 'lead-tracker']
  },
  {
    id: 'vpa-plus-prospects',
    displayName: 'Growth Plan',
    priceMonthly: 8000,
    modules: ['vpa-core', 'lead-tracker', 'prospect-finder']
  },
  // ... more plans
]

// Usage in admin tools
import { PRICING_PLANS } from '../../src/config/pricing.js';

PRICING_PLANS.forEach((plan, idx) => {
  console.log(`[${idx + 1}] ${plan.displayName}`);
});
```

### Database Client Integration

```typescript
// Import
import { db } from '../../src/db/client.js';

// Connect
await db.connect();

// Query
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Transaction
await db.query('BEGIN');
try {
  await db.query('INSERT INTO ...');
  await db.query('INSERT INTO ...');
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
}

// Disconnect
await db.disconnect();
```

### Logger Integration

```typescript
// Import
import { logger, logError } from '../../src/utils/logger.js';

// Success logging
logger.info('Admin: User created', {
  adminAction: 'create-user',
  userId,
  email,
  planId
});

// Error logging
try {
  // ... operation
} catch (error) {
  logError('Failed to create user', error);
  throw error;
}
```

---

## Security Architecture

### Input Validation Layer

```
User Input
    │
    ▼
┌─────────────────────┐
│  Validation Layer   │
│                     │
│  • Email format     │
│  • Number ranges    │
│  • Data constraints │
│  • SQL injection    │
│    prevention       │
└─────────┬───────────┘
          │
          ▼
    Business Logic
```

### Transaction Safety

```
Operation Start
    │
    ├─→ BEGIN TRANSACTION
    │
    ├─→ Query 1 (INSERT user)
    │    │
    │    ├─→ Success → Continue
    │    └─→ Error → ROLLBACK → Exit
    │
    ├─→ Query 2 (INSERT subscription)
    │    │
    │    ├─→ Success → Continue
    │    └─→ Error → ROLLBACK → Exit
    │
    ├─→ COMMIT TRANSACTION
    │
    └─→ Success
```

### License Key Generation

```
Random Generation
    │
    ├─→ Segment 1: 4 chars (A-Z, 0-9)
    ├─→ Segment 2: 4 chars (A-Z, 0-9)
    ├─→ Segment 3: 4 chars (A-Z, 0-9)
    └─→ Segment 4: 4 chars (A-Z, 0-9)
         │
         ▼
    Format: VPA-XXXX-XXXX-XXXX-XXXX
         │
         ▼
    Store in Database (UNIQUE constraint)
```

---

## Error Handling Architecture

### Three-Layer Error Handling

```
┌──────────────────────────────────────────┐
│           User Interface Layer           │
│                                          │
│  • Friendly error messages               │
│  • Retry prompts                         │
│  • Clear instructions                    │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│         Business Logic Layer             │
│                                          │
│  • Try/catch blocks                      │
│  • Transaction rollback                  │
│  • Error context gathering               │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│            Logging Layer                 │
│                                          │
│  • Winston logger                        │
│  • Error details to file                 │
│  • Stack traces                          │
└──────────────────────────────────────────┘
```

### Error Flow Example

```
User Action
    │
    ▼
Try {
    Validate Input
        │
        ├─→ Invalid → Throw ValidationError
        │                │
        │                ├─→ Catch → Display Error
        │                └─→ Retry Prompt
        │
        ▼
    Database Operation
        │
        ├─→ Connection Error → Throw DatabaseError
        │                         │
        │                         ├─→ Catch → Display Error
        │                         ├─→ Log to File
        │                         └─→ Exit
        │
        ▼
    Success
}
```

---

## Performance Optimization

### Database Query Optimization

```
Indexed Columns:
  • users.email (UNIQUE)
  • users.license_key (UNIQUE)
  • user_subscriptions.user_id
  • user_usage.user_id
  • user_usage.timestamp

Connection Pooling:
  • Max connections: 20
  • Idle timeout: 30s
  • Connection timeout: 10s

Query Patterns:
  • Parameterized queries (prevent SQL injection)
  • Selective columns (SELECT specific fields)
  • Aggregation in database (not in application)
```

### Memory Management

```
Streaming Large Results:
  • CSV export processes in chunks
  • Pagination for large user lists
  • Limit usage queries to time ranges

Connection Management:
  • Connect at start
  • Reuse connection
  • Disconnect at end
  • Automatic cleanup on error
```

---

## Scalability Considerations

### Current Capacity

```
Database:
  • PostgreSQL with connection pooling
  • Handles 1000s of users easily
  • Usage table indexed for performance

Admin Tools:
  • Single admin at a time
  • No concurrent write conflicts
  • Safe for 10-100 users/day onboarding
```

### Future Scaling

```
If Growth Occurs:
  │
  ├─→ Database
  │    ├─→ Read replicas for analytics
  │    ├─→ Partitioning user_usage table
  │    └─→ Archive old usage data
  │
  ├─→ Admin Tools
  │    ├─→ Multi-admin support
  │    ├─→ Concurrent operation locks
  │    └─→ Audit trail for conflicts
  │
  └─→ Analytics
       ├─→ Background aggregation jobs
       ├─→ Cached statistics
       └─→ Real-time dashboards
```

---

## Integration Points

### External Systems

```
┌────────────────────────────────────────┐
│         VPA Admin Tools                │
└────────────┬───────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼───┐ ┌──▼──┐ ┌──▼────────┐
│  DB   │ │ Log │ │  Pricing  │
│ (PG)  │ │File │ │  Config   │
└───┬───┘ └─────┘ └───────────┘
    │
    │
┌───▼────────────────────────────────────┐
│  Future Integrations:                  │
│                                        │
│  • Stripe API (payment processing)     │
│  • Email service (notifications)       │
│  • Slack/Discord (admin alerts)        │
│  • Analytics platform (metrics)        │
└────────────────────────────────────────┘
```

### Module System

```
VPA Core
    │
    ├─→ Module: lead-tracker
    ├─→ Module: prospect-finder
    ├─→ Module: email-orchestrator
    └─→ Module: vpa-core (base)
         │
         └─→ Admin tools manage access
              via user_subscriptions.modules
```

---

## Deployment Architecture

### Development

```
Local Machine
    │
    ├─→ vpa-core/
    │    ├─→ .env (DATABASE_URL=localhost)
    │    └─→ npm run admin:*
    │
    └─→ PostgreSQL (local)
         └─→ Test database
```

### Production

```
Production Server
    │
    ├─→ vpa-core/
    │    ├─→ .env (DATABASE_URL=production)
    │    ├─→ NODE_ENV=production
    │    └─→ npm run admin:*
    │
    ├─→ PostgreSQL (hosted)
    │    ├─→ Neon.tech / AWS RDS
    │    └─→ Production database
    │
    └─→ Logs
         └─→ logs/vpa-error.log
              └─→ logs/vpa-combined.log
```

---

## Monitoring & Observability

### Logging Architecture

```
Admin Action
    │
    ├─→ Winston Logger
    │    │
    │    ├─→ Console (formatted)
    │    ├─→ File (JSON)
    │    └─→ Level: info/error/debug
    │
    └─→ Database (user_usage)
         └─→ Track all user actions
```

### Health Monitoring

```
Daily Health Check
    │
    ├─→ Database connectivity
    ├─→ Table integrity
    ├─→ Data consistency
    ├─→ Usage statistics
    └─→ System metrics
         │
         └─→ Generate report
              └─→ Email/Slack alert (future)
```

---

**Built with elegance by Forge**
*Technical architecture designed for scalability and maintainability*
