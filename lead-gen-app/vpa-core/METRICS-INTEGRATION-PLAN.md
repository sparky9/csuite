# Metrics Dashboard Integration Plan

## Overview
This document outlines how VPA-Core metrics dashboard connects to module databases and the integration roadmap for future modules.

## Current Architecture

### Database Connection Strategy
**Approach:** Shared connection pool via `db/client.ts`

VPA-Core uses a single PostgreSQL connection pool that all modules share:
- **Pool size:** 20 connections (configurable)
- **Timeout:** 30 seconds idle, 10 seconds connection
- **SSL:** Auto-enabled for Neon/AWS hosts

**Why shared pool?**
- ✅ Connection efficiency (reuse across modules)
- ✅ Simpler configuration (one DATABASE_URL)
- ✅ Centralized monitoring and error handling
- ✅ Works for current scale (all modules in same DB)

**Future consideration:** If modules move to separate databases, we can add per-module clients.

---

## Module Integration Status

### ✅ LeadTracker Pro - IMPLEMENTED

**Status:** Fully integrated
**Database:** `prospects` table (same DB as VPA-Core)
**Connection:** Shared pool via `db.query()`

**Queries:**
```sql
-- Active prospects
SELECT COUNT(*) FROM prospects
WHERE user_id = $1
  AND status NOT IN ('closed_won', 'closed_lost')

-- Deals won (in timeframe)
SELECT COUNT(*) FROM prospects
WHERE user_id = $1
  AND status = 'closed_won'
  AND updated_at >= $2 AND updated_at < $3

-- Deals lost (in timeframe)
SELECT COUNT(*) FROM prospects
WHERE user_id = $1
  AND status = 'closed_lost'
  AND updated_at >= $2 AND updated_at < $3
```

**Integration pattern:**
```typescript
private async fetchPipelineData(userId, startDate, endDate) {
  const result = await db.query(`SELECT ...`, [userId, startDate, endDate]);
  return {
    activeProspects: result.rows[0].active_prospects,
    dealsWon: result.rows[0].deals_won,
    dealsLost: result.rows[0].deals_lost
  };
}
```

---

### ⏳ Bookkeeping Assistant - PENDING

**Status:** Module not built yet
**Estimated availability:** Q2 2026
**Database schema (proposed):**

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL, -- 'income' or 'expense'
  category TEXT,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration code (ready to implement):**
```typescript
private async fetchBusinessData(userId, startDate, endDate) {
  const result = await db.query(`
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS revenue,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
    FROM transactions
    WHERE user_id = $1
      AND date >= $2 AND date < $3
  `, [userId, startDate, endDate]);

  return {
    revenue: result.rows[0]?.revenue || 0,
    expenses: result.rows[0]?.expenses || 0
  };
}
```

**TODO when module is ready:**
1. Add `fetchBusinessData()` method to `metrics.module.ts`
2. Call it in `fetchRawMetrics()` parallel Promise.all
3. Replace placeholder zeros with real data
4. Test anomaly detection for revenue/expense spikes

---

### ⏳ Time & Billing Agent - PENDING

**Status:** Module not built yet
**Estimated availability:** Q3 2026
**Database schema (proposed):**

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  billable BOOLEAN NOT NULL DEFAULT true,
  project_name TEXT,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration code (ready to implement):**
```typescript
private async fetchProductivityData(userId, startDate, endDate) {
  const result = await db.query(`
    SELECT
      SUM(CASE WHEN billable = true THEN hours ELSE 0 END) AS billable_hours,
      SUM(CASE WHEN billable = false THEN hours ELSE 0 END) AS non_billable_hours
    FROM time_entries
    WHERE user_id = $1
      AND date >= $2 AND date < $3
  `, [userId, startDate, endDate]);

  return {
    billableHours: result.rows[0]?.billable_hours || 0,
    nonBillableHours: result.rows[0]?.non_billable_hours || 0
  };
}
```

**TODO when module is ready:**
1. Add `fetchProductivityData()` method to `metrics.module.ts`
2. Call it in `fetchRawMetrics()` parallel Promise.all
3. Replace placeholder zeros with real data
4. Test anomaly detection for billable hours drops

---

### ⏳ Reputation & Review Agent - PENDING

**Status:** Module not built yet
**Estimated availability:** Q4 2026
**Database schema (proposed):**

```sql
CREATE TABLE testimonials (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  testimonial_text TEXT NOT NULL,
  rating INTEGER, -- 1-5
  public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL, -- 'google', 'yelp', etc.
  rating DECIMAL(2,1) NOT NULL, -- 1.0-5.0
  review_text TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration code (ready to implement):**
```typescript
private async fetchReputationData(userId, startDate, endDate) {
  const [testimonials, reviews] = await Promise.all([
    db.query(`
      SELECT COUNT(*) AS count
      FROM testimonials
      WHERE user_id = $1
        AND created_at >= $2 AND created_at < $3
    `, [userId, startDate, endDate]),

    db.query(`
      SELECT
        COUNT(*) AS count,
        SUM(rating) AS total_rating
      FROM reviews
      WHERE user_id = $1
        AND reviewed_at >= $2 AND reviewed_at < $3
    `, [userId, startDate, endDate])
  ]);

  return {
    testimonials: testimonials.rows[0]?.count || 0,
    publicReviews: reviews.rows[0]?.count || 0,
    totalRating: reviews.rows[0]?.total_rating || 0,
    reviewCount: reviews.rows[0]?.count || 0
  };
}
```

**TODO when module is ready:**
1. Add `fetchReputationData()` method to `metrics.module.ts`
2. Call it in `fetchRawMetrics()` parallel Promise.all
3. Replace placeholder zeros with real data
4. Anomaly detection already handles rating drops

---

## Integration Checklist (Per Module)

When a new module becomes available:

### 1. Database Schema Review
- [ ] Confirm table names and column types
- [ ] Verify user_id foreign key exists
- [ ] Check timestamp columns for date filtering
- [ ] Test query performance on sample data

### 2. Code Integration
- [ ] Add `fetch{Module}Data()` method to `metrics.module.ts`
- [ ] Add method to `fetchRawMetrics()` Promise.all
- [ ] Replace placeholder zeros with real data fields
- [ ] Update TypeScript types if schema differs
- [ ] Add error handling for module-specific failures

### 3. Testing
- [ ] Unit test: fetch method with mock data
- [ ] Integration test: real DB queries
- [ ] Edge case: module DB unreachable (graceful degradation)
- [ ] Performance test: query execution time < 500ms
- [ ] Cache verification: 5-minute TTL working

### 4. Anomaly Detection
- [ ] Verify thresholds make sense for new data
- [ ] Test anomaly recommendations
- [ ] Adjust severity levels if needed
- [ ] Add new anomaly types if relevant

### 5. Documentation
- [ ] Update module status in `metrics.module.ts` header
- [ ] Add integration example to this document
- [ ] Update API documentation
- [ ] Add to changelog

---

## Performance Considerations

### Query Optimization
- **Parallel execution:** All module queries run concurrently
- **Expected total time:** 200-500ms (cache miss)
- **Indexes needed:**
  - `(user_id, date)` on all tables
  - `(user_id, status, updated_at)` on prospects

### Caching Strategy
- **TTL:** 5 minutes (good balance of freshness vs. load)
- **Cache key:** `metrics:{userId}:{timeframe}`
- **Invalidation:** Automatic on TTL expiry
- **Manual clear:** After data imports or bulk updates

### Scaling Considerations
- **Current scale:** Handles 1000s of users
- **Future scale:** If > 10k users, consider:
  - Materialized views for aggregations
  - Redis for distributed caching
  - Read replicas for metrics queries

---

## Alternative Architectures (Future)

### Option A: Per-Module Database Clients
If modules move to separate databases:

```typescript
// config/database.ts
export const moduleConnections = {
  leadtracker: new Pool({ connectionString: process.env.LEADTRACKER_DB }),
  bookkeeping: new Pool({ connectionString: process.env.BOOKKEEPING_DB }),
  timebilling: new Pool({ connectionString: process.env.TIMEBILLING_DB }),
  reputation: new Pool({ connectionString: process.env.REPUTATION_DB })
};

// metrics.module.ts
private async fetchBusinessData(userId, startDate, endDate) {
  const result = await moduleConnections.bookkeeping.query(...);
  return { revenue, expenses };
}
```

**Pros:** Database isolation, independent scaling
**Cons:** More connection overhead, complex configuration

### Option B: Module API Endpoints
If modules expose REST/GraphQL APIs:

```typescript
private async fetchBusinessData(userId, startDate, endDate) {
  const response = await fetch('http://bookkeeping-api/metrics', {
    method: 'POST',
    body: JSON.stringify({ userId, startDate, endDate })
  });
  return response.json();
}
```

**Pros:** Module encapsulation, language-agnostic
**Cons:** Network latency, additional error handling

---

## Rollout Plan for Each Module

### Week 1: Module Launch
1. Module database schema deployed
2. Integration code ready in `metrics.module.ts`
3. Unit tests passing
4. Feature flag enabled for 10% of users

### Week 2: Beta Testing
1. Monitor error rates and query performance
2. Gather user feedback on new metrics
3. Adjust anomaly thresholds based on real data
4. Fix any edge cases

### Week 3: Full Rollout
1. Enable for 100% of users
2. Update user documentation
3. Announce in changelog
4. Monitor for anomalies in production

---

## Questions & Answers

**Q: What if a module's database is temporarily unavailable?**
A: Graceful degradation - return zeros for that module, log error, continue with other modules.

**Q: Should metrics dashboard wait for all modules or show partial data?**
A: Show partial data. Users get value from pipeline metrics even if bookkeeping is loading.

**Q: How do we handle different date formats across modules?**
A: Standardize on PostgreSQL TIMESTAMPTZ. Convert in queries if needed.

**Q: Can users customize which metrics appear in their dashboard?**
A: Future enhancement. For now, all enabled modules show in dashboard.

**Q: How do we prevent one slow module from blocking others?**
A: Parallel queries + individual timeouts + catch errors per module.

---

## Contact & Ownership

**Primary owner:** VPA-Core team
**Module integrations:** Coordinate with respective module teams
**Questions:** Check #vpa-metrics channel

---

**Last updated:** 2025-01-XX
**Next review:** After each new module launch
