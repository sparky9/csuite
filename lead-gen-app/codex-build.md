# VPA Ecosystem Build Specification

**Target:** 14-module solopreneur-focused Virtual Personal Assistant ecosystem
**Objective:** Build 2 new modules + enhance 7 existing modules to A/A+ production quality
**Timeline:** Current sprint
**Built by:** Codex
**Reviewed by:** Forge

---

## 🎯 Strategic Goals

1. **Quality over quantity** - 14 focused modules beats 20 scattered ones
2. **Solopreneur-first** - Every feature solves real pain for 1-10 person businesses
3. **Consistent architecture** - All modules follow same structure/patterns
4. **Pricing differentiation** - Enhanced features enable Basic ($49/mo) and Pro ($99/mo) tiers

---

## 📐 Technical Standards

All modules MUST follow these standards:

### **Directory Structure**

```
module-name/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/                # MCP tool definitions & handlers
│   ├── services/             # Business logic layer
│   ├── db/
│   │   ├── client.ts         # Database connection & transaction helpers
│   │   └── schema.sql        # PostgreSQL schema
│   ├── types/                # TypeScript interfaces & types
│   └── utils/                # Logging, validation, helpers
├── scripts/
│   ├── setup-database.ts     # Schema setup script
│   └── test-*.ts            # Smoke tests
├── dist/                     # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── .env.example              # Environment template
└── README.md
```

### **Required Dependencies**

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "pg": "^8.x",
  "zod": "^3.x",
  "winston": "^3.x"
}
```

### **Code Quality Requirements**

- ✅ TypeScript strict mode enabled
- ✅ Zod validation on ALL tool inputs
- ✅ Try-catch in all tool handlers with MCP error format
- ✅ Winston structured logging (logger.info/error)
- ✅ Transaction-wrapped database operations (withTransaction)
- ✅ Graceful shutdown handlers (SIGINT/SIGTERM)
- ✅ .env fallback handling (DATABASE_URL optional = in-memory mode)

### **Database Standards**

- ✅ UUID primary keys (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
- ✅ Timestamps (`created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ`)
- ✅ User isolation (`user_id TEXT NOT NULL` with index)
- ✅ Foreign keys with CASCADE deletes
- ✅ JSONB for flexible metadata
- ✅ Proper indexes on query paths

### **MCP Tool Standards**

- ✅ Clear tool names (verb_noun pattern: `track_expense`, `generate_report`)
- ✅ Comprehensive input schemas with descriptions
- ✅ Structured JSON responses (success/error pattern)
- ✅ Logged execution time via `logToolExecution()`

---

## 🆕 NEW MODULE #1: Reputation & Review Agent

**Module Name:** `reputation-review-agent`
**Purpose:** Automate testimonial collection → public review generation → reputation management
**Grade Target:** A
**Database:** PostgreSQL required

### **Value Proposition**

Solopreneurs struggle to ask for reviews (feels awkward) and forget to follow up. This automates the entire reputation-building workflow from project completion to public reviews.

### **MCP Tools (8 total)**

#### 1. `reputation_request_testimonial`

**Description:** Request testimonial from client after project completion
**Inputs:**

- `userId` (string, required)
- `clientId` (string, required) - Reference to LeadTracker client
- `projectName` (string, required)
- `completionDate` (string, ISO date)
- `requestTemplate` (string, optional) - Custom message template
- `deliveryMethod` (enum: 'email' | 'sms' | 'both', default: 'email')
- `followUpDays` (number, optional, default: 7) - Days until reminder

**Output:**

```json
{
  "requestId": "uuid",
  "status": "sent",
  "deliveryMethod": "email",
  "followUpScheduled": "2025-11-01T10:00:00Z"
}
```

#### 2. `reputation_record_testimonial`

**Description:** Record received testimonial (manual entry or webhook)
**Inputs:**

- `requestId` (string, required)
- `testimonialText` (string, required)
- `rating` (number, 1-5, required)
- `clientName` (string, required)
- `clientTitle` (string, optional)
- `clientCompany` (string, optional)
- `permissionGranted` (boolean, required) - Can we use publicly?
- `receivedDate` (string, ISO date)

**Output:**

```json
{
  "testimonialId": "uuid",
  "status": "recorded",
  "publicUseApproved": true,
  "nextAction": "funnel_to_review_site"
}
```

#### 3. `reputation_funnel_to_review_site`

**Description:** Generate personalized review request for Google/Yelp/Trustpilot
**Inputs:**

- `testimonialId` (string, required)
- `platform` (enum: 'google' | 'yelp' | 'trustpilot' | 'facebook', required)
- `businessProfileUrl` (string, required) - Direct link to review page

**Output:**

```json
{
  "funnelId": "uuid",
  "platform": "google",
  "messageTemplate": "Hi [Name], thanks for your kind words! Would you mind sharing...",
  "reviewLink": "https://g.page/r/...",
  "status": "ready_to_send"
}
```

#### 4. `reputation_track_review_status`

**Description:** Check if client completed public review
**Inputs:**

- `funnelId` (string, required)

**Output:**

```json
{
  "funnelId": "uuid",
  "platform": "google",
  "status": "completed",
  "reviewUrl": "https://...",
  "publicRating": 5,
  "completedAt": "2025-11-05T14:30:00Z"
}
```

#### 5. `reputation_triage_negative_feedback`

**Description:** Record negative feedback privately before public escalation
**Inputs:**

- `userId` (string, required)
- `clientId` (string, required)
- `feedbackText` (string, required)
- `rating` (number, 1-5, required)
- `issueCategory` (enum: 'quality' | 'communication' | 'timeline' | 'pricing' | 'other')

**Output:**

```json
{
  "feedbackId": "uuid",
  "severity": "high",
  "suggestedAction": "immediate_outreach",
  "taskCreated": true,
  "taskId": "uuid"
}
```

#### 6. `reputation_generate_case_study`

**Description:** Convert testimonial into formatted case study
**Inputs:**

- `testimonialId` (string, required)
- `format` (enum: 'pdf' | 'html' | 'markdown', default: 'markdown')
- `includeMetrics` (boolean, default: false) - Add project metrics/results

**Output:**

```json
{
  "caseStudyId": "uuid",
  "format": "markdown",
  "content": "# Case Study: [Client Name]\n\n...",
  "downloadUrl": null
}
```

#### 7. `reputation_get_stats`

**Description:** Reputation metrics dashboard
**Inputs:**

- `userId` (string, required)
- `timeframe` (enum: '30d' | '90d' | '1y' | 'all', default: '90d')

**Output:**

```json
{
  "testimonials": {
    "total": 45,
    "avgRating": 4.8,
    "publicUseApproved": 38
  },
  "publicReviews": {
    "google": 23,
    "yelp": 12,
    "trustpilot": 5
  },
  "negativeFeedback": {
    "total": 3,
    "resolved": 2,
    "pending": 1
  },
  "conversionRate": "84%"
}
```

#### 8. `reputation_list_testimonials`

**Description:** List testimonials with filtering
**Inputs:**

- `userId` (string, required)
- `filter` (enum: 'all' | 'public' | 'private' | 'pending', default: 'all')
- `minRating` (number, optional)
- `limit` (number, default: 20)

**Output:**

```json
{
  "testimonials": [
    {
      "id": "uuid",
      "clientName": "John Doe",
      "rating": 5,
      "text": "Outstanding work...",
      "publicUse": true,
      "reviewCompleted": true,
      "createdAt": "2025-10-15"
    }
  ],
  "total": 45
}
```

### **Database Schema**

```sql
-- Testimonial requests
CREATE TABLE reputation_testimonial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  completion_date DATE,
  request_template TEXT,
  delivery_method TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, received, declined
  follow_up_days INTEGER DEFAULT 7,
  follow_up_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_testimonial_requests_user ON reputation_testimonial_requests(user_id);
CREATE INDEX idx_testimonial_requests_status ON reputation_testimonial_requests(status);

-- Received testimonials
CREATE TABLE reputation_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES reputation_testimonial_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_title TEXT,
  client_company TEXT,
  testimonial_text TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  permission_granted BOOLEAN NOT NULL DEFAULT false,
  received_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_testimonials_user ON reputation_testimonials(user_id);
CREATE INDEX idx_testimonials_rating ON reputation_testimonials(rating);

-- Review site funneling
CREATE TABLE reputation_review_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id UUID REFERENCES reputation_testimonials(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- google, yelp, trustpilot, facebook
  business_profile_url TEXT NOT NULL,
  message_template TEXT,
  status TEXT NOT NULL DEFAULT 'ready', -- ready, sent, completed, declined
  review_url TEXT,
  public_rating INTEGER CHECK (public_rating >= 1 AND public_rating <= 5),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_funnels_user ON reputation_review_funnels(user_id);
CREATE INDEX idx_review_funnels_platform ON reputation_review_funnels(platform);
CREATE INDEX idx_review_funnels_status ON reputation_review_funnels(status);

-- Negative feedback triage
CREATE TABLE reputation_negative_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  issue_category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, resolved, escalated
  resolution_notes TEXT,
  task_id UUID, -- Reference to task-manager task
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_negative_feedback_user ON reputation_negative_feedback(user_id);
CREATE INDEX idx_negative_feedback_status ON reputation_negative_feedback(status);
CREATE INDEX idx_negative_feedback_severity ON reputation_negative_feedback(severity);

-- Case studies
CREATE TABLE reputation_case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id UUID REFERENCES reputation_testimonials(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'markdown',
  content TEXT NOT NULL,
  metrics_included BOOLEAN DEFAULT false,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_studies_user ON reputation_case_studies(user_id);

-- Audit log
CREATE TABLE reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reputation_events_user ON reputation_events(user_id);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);
```

### **Key Features**

1. **Automated Request Workflow**

   - Trigger testimonial requests on project completion
   - Configurable follow-up reminders
   - Email/SMS delivery support

2. **Permission Management**

   - Track public use permissions
   - Filter testimonials by approval status
   - Respect privacy preferences

3. **Platform Integration**

   - Generate platform-specific review requests
   - Track completion across Google/Yelp/Trustpilot
   - Direct review page links

4. **Negative Feedback Protection**

   - Private triage before public escalation
   - Severity scoring and suggested actions
   - Auto-create resolution tasks

5. **Case Study Generation**

   - Convert testimonials to formatted case studies
   - Multiple output formats (PDF/HTML/Markdown)
   - Optional metrics inclusion

6. **Analytics Dashboard**
   - Conversion rates (testimonial → public review)
   - Platform-specific review counts
   - Average ratings and trends

### **Integration Points**

- **LeadTracker Pro:** Reference client_id for relationship tracking
- **Task Manager:** Auto-create tasks for negative feedback resolution
- **Email Orchestrator:** Send testimonial requests and reminders
- **VPA Core:** Expose via `vpa_reputation` unified tool

### **Implementation Notes**

- Use deterministic templates for requests (no AI required initially)
- Store review platform URLs in .env (GOOGLE_REVIEW_URL, YELP_URL, etc.)
- Log all events to audit table for compliance
- Graceful degradation: Works without database (ephemeral mode)

---

## 🆕 NEW MODULE #2: Time & Billing Agent

**Module Name:** `time-billing-agent`
**Purpose:** Track billable hours → generate invoices → chase payments
**Grade Target:** A
**Database:** PostgreSQL required

### **Value Proposition**

Solopreneurs often undercharge because they don't track time accurately. This module prevents "scope creep poverty" by tracking time, enforcing rate cards, and automating payment collection.

### **MCP Tools (10 total)**

#### 1. `time_track_entry`

**Description:** Log time entry for a project/task
**Inputs:**

- `userId` (string, required)
- `clientId` (string, required)
- `projectName` (string, required)
- `taskDescription` (string, required)
- `duration` (number, required) - Minutes
- `startTime` (string, ISO datetime, optional)
- `endTime` (string, ISO datetime, optional)
- `billable` (boolean, default: true)
- `notes` (string, optional)

**Output:**

```json
{
  "entryId": "uuid",
  "duration": 120,
  "billable": true,
  "calculatedAmount": 200.0,
  "hourlyRate": 100.0
}
```

#### 2. `time_get_entries`

**Description:** List time entries with filtering
**Inputs:**

- `userId` (string, required)
- `clientId` (string, optional) - Filter by client
- `projectName` (string, optional)
- `startDate` (string, ISO date, optional)
- `endDate` (string, ISO date, optional)
- `billable` (boolean, optional)
- `invoiced` (boolean, optional) - Only show uninvoiced entries
- `limit` (number, default: 50)

**Output:**

```json
{
  "entries": [
    {
      "id": "uuid",
      "clientId": "client-123",
      "projectName": "Website Redesign",
      "taskDescription": "Homepage mockups",
      "duration": 120,
      "billable": true,
      "invoiced": false,
      "amount": 200.0,
      "date": "2025-10-24"
    }
  ],
  "totalHours": 24.5,
  "totalAmount": 2450.0,
  "unbilledAmount": 800.0
}
```

#### 3. `billing_set_rate_card`

**Description:** Set hourly rates for client or project
**Inputs:**

- `userId` (string, required)
- `clientId` (string, optional) - Client-specific rate
- `projectName` (string, optional) - Project-specific rate
- `hourlyRate` (number, required)
- `currency` (string, default: 'USD')
- `effectiveDate` (string, ISO date, optional)

**Output:**

```json
{
  "rateCardId": "uuid",
  "clientId": "client-123",
  "hourlyRate": 150.0,
  "currency": "USD",
  "effectiveDate": "2025-10-24"
}
```

#### 4. `billing_get_rate_cards`

**Description:** List rate cards with hierarchy (project > client > default)
**Inputs:**

- `userId` (string, required)
- `clientId` (string, optional)

**Output:**

```json
{
  "rateCards": [
    {
      "id": "uuid",
      "clientId": "client-123",
      "projectName": null,
      "hourlyRate": 150.0,
      "currency": "USD",
      "isDefault": false
    }
  ],
  "defaultRate": 100.0
}
```

#### 5. `billing_generate_invoice`

**Description:** Create invoice from unbilled time entries
**Inputs:**

- `userId` (string, required)
- `clientId` (string, required)
- `timeEntryIds` (array of strings, optional) - Specific entries, or auto-select unbilled
- `invoiceDate` (string, ISO date, optional)
- `dueDate` (string, ISO date, optional) - Default: net-30
- `notes` (string, optional)
- `taxRate` (number, optional) - Percentage
- `discountAmount` (number, optional)

**Output:**

```json
{
  "invoiceId": "uuid",
  "invoiceNumber": "INV-2025-001",
  "clientId": "client-123",
  "subtotal": 2450.0,
  "tax": 171.5,
  "discount": 0,
  "total": 2621.5,
  "dueDate": "2025-11-23",
  "status": "draft",
  "timeEntriesIncluded": 12
}
```

#### 6. `billing_send_invoice`

**Description:** Mark invoice as sent and track delivery
**Inputs:**

- `invoiceId` (string, required)
- `deliveryMethod` (enum: 'email' | 'mail' | 'portal', default: 'email')
- `recipientEmail` (string, optional)

**Output:**

```json
{
  "invoiceId": "uuid",
  "status": "sent",
  "sentAt": "2025-10-24T10:00:00Z",
  "deliveryMethod": "email",
  "trackingEnabled": true
}
```

#### 7. `billing_track_invoice_status`

**Description:** Check invoice payment status
**Inputs:**

- `invoiceId` (string, required)

**Output:**

```json
{
  "invoiceId": "uuid",
  "invoiceNumber": "INV-2025-001",
  "status": "overdue",
  "sentAt": "2025-09-24T10:00:00Z",
  "viewedAt": "2025-09-25T14:30:00Z",
  "dueDate": "2025-10-24",
  "daysOverdue": 0,
  "total": 2621.5,
  "amountPaid": 0,
  "amountDue": 2621.5
}
```

#### 8. `billing_record_payment`

**Description:** Record invoice payment (full or partial)
**Inputs:**

- `invoiceId` (string, required)
- `amount` (number, required)
- `paymentDate` (string, ISO date, required)
- `paymentMethod` (enum: 'check' | 'ach' | 'credit_card' | 'wire' | 'paypal' | 'stripe')
- `transactionId` (string, optional)
- `notes` (string, optional)

**Output:**

```json
{
  "paymentId": "uuid",
  "invoiceId": "uuid",
  "amountPaid": 2621.5,
  "remainingBalance": 0,
  "invoiceStatus": "paid",
  "paidAt": "2025-10-24T15:00:00Z"
}
```

#### 9. `billing_generate_payment_reminder`

**Description:** Generate friendly/firm payment reminder message
**Inputs:**

- `invoiceId` (string, required)
- `tone` (enum: 'friendly' | 'firm' | 'urgent', default: 'friendly')

**Output:**

```json
{
  "reminderId": "uuid",
  "invoiceNumber": "INV-2025-001",
  "tone": "friendly",
  "subject": "Friendly reminder: Invoice INV-2025-001 due",
  "messageBody": "Hi [Client],\n\nJust a friendly reminder...",
  "suggestedSendDate": "2025-10-24"
}
```

#### 10. `billing_get_profitability_report`

**Description:** Analyze profitability by client/project
**Inputs:**

- `userId` (string, required)
- `clientId` (string, optional)
- `projectName` (string, optional)
- `startDate` (string, ISO date, optional)
- `endDate` (string, ISO date, optional)

**Output:**

```json
{
  "clients": [
    {
      "clientId": "client-123",
      "clientName": "Acme Corp",
      "totalHours": 48.5,
      "totalBilled": 7275.0,
      "totalPaid": 5000.0,
      "avgHourlyRate": 150.0,
      "paymentVelocity": "slow",
      "profitMargin": "high"
    }
  ],
  "summary": {
    "totalRevenue": 25000.0,
    "totalOutstanding": 8000.0,
    "avgPaymentDays": 35,
    "topClient": "Acme Corp"
  }
}
```

### **Database Schema**

```sql
-- Time entries
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  task_description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  billable BOOLEAN DEFAULT true,
  invoiced BOOLEAN DEFAULT false,
  invoice_id UUID,
  hourly_rate NUMERIC(10,2),
  calculated_amount NUMERIC(10,2),
  notes TEXT,
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_client ON time_entries(client_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX idx_time_entries_invoiced ON time_entries(invoiced);

-- Rate cards (hierarchical: project > client > default)
CREATE TABLE billing_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT,
  project_name TEXT,
  hourly_rate NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  effective_date DATE DEFAULT CURRENT_DATE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_cards_user ON billing_rate_cards(user_id);
CREATE INDEX idx_rate_cards_client ON billing_rate_cards(client_id);

-- Invoices
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, viewed, paid, overdue, cancelled
  subtotal NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  delivery_method TEXT,
  recipient_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON billing_invoices(user_id);
CREATE INDEX idx_invoices_client ON billing_invoices(client_id);
CREATE INDEX idx_invoices_status ON billing_invoices(status);
CREATE INDEX idx_invoices_due_date ON billing_invoices(due_date);

-- Payments
CREATE TABLE billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON billing_payments(invoice_id);
CREATE INDEX idx_payments_user ON billing_payments(user_id);

-- Payment reminders
CREATE TABLE billing_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  tone TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_body TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_invoice ON billing_reminders(invoice_id);
CREATE INDEX idx_reminders_user ON billing_reminders(user_id);

-- Audit log
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_events_user ON billing_events(user_id);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
```

### **Key Features**

1. **Flexible Time Tracking**

   - Manual entry with start/end times
   - Duration-based (pomodoro style)
   - Billable/non-billable flagging
   - Project and task association

2. **Hierarchical Rate Cards**

   - Default user rate
   - Client-specific rates
   - Project-specific overrides
   - Historical rate tracking

3. **Smart Invoice Generation**

   - Auto-select unbilled time entries
   - Tax and discount calculations
   - Sequential invoice numbering
   - Net-30/60 due date presets

4. **Payment Tracking**

   - Partial payment support
   - Multiple payment methods
   - Transaction ID tracking
   - Automatic status updates

5. **Payment Collection**

   - Tone-based reminder templates (friendly → urgent)
   - Overdue detection with days calculation
   - Suggested send dates
   - View/open tracking

6. **Profitability Analytics**
   - Revenue by client/project
   - Average hourly rates
   - Payment velocity scoring
   - Outstanding balance tracking

### **Integration Points**

- **LeadTracker Pro:** Reference client_id for relationship data
- **Bookkeeping-Assistant:** Push paid invoices as income transactions
- **Task Manager:** Create follow-up tasks for overdue invoices
- **Email Orchestrator:** Send invoices and payment reminders
- **VPA Core:** Expose via `vpa_time` and `vpa_billing` unified tools

### **Implementation Notes**

- Auto-calculate invoice numbers (INV-YYYY-NNN pattern)
- Store invoice templates in .env or database
- Support multiple currencies via rate cards
- Log all events for audit trail
- Graceful degradation: Works without database (ephemeral mode)
- Consider Stripe/PayPal webhook integration for auto-payment recording

---

## 🔧 MODULE ENHANCEMENTS

### **Enhancement #1: LeadTracker-Pro (A+ → A++)**

**Objective:** Add client health monitoring and upsell detection

#### **New Tools (3 total)**

##### `analyze_client_health`

**Description:** Compute health score with risk factors
**Inputs:**

- `userId` (string, required)
- `prospectId` (string, required)

**Output:**

```json
{
  "prospectId": "uuid",
  "healthScore": 75,
  "healthLevel": "healthy",
  "signals": {
    "lastInteractionDays": 5,
    "paymentStatus": "current",
    "projectCount": 3,
    "avgResponseTimeHours": 12,
    "sentimentTrend": "positive"
  },
  "riskFactors": [],
  "recommendations": ["Schedule quarterly check-in"]
}
```

##### `detect_upsell_opportunities`

**Description:** Identify expansion opportunities from purchase history
**Inputs:**

- `userId` (string, required)
- `prospectId` (string, optional) - Specific client, or all
- `minConfidence` (number, optional, default: 0.7)

**Output:**

```json
{
  "opportunities": [
    {
      "prospectId": "uuid",
      "clientName": "Acme Corp",
      "currentServices": ["SEO Consulting"],
      "suggestedUpsell": "Content Writing Package",
      "confidence": 0.85,
      "reasoning": "Client frequently asks about blog content",
      "estimatedValue": 2000.0
    }
  ]
}
```

##### `generate_upsell_pitch`

**Description:** Create personalized upsell pitch
**Inputs:**

- `prospectId` (string, required)
- `upsellService` (string, required)
- `tone` (enum: 'casual' | 'professional' | 'executive', default: 'professional')

**Output:**

```json
{
  "pitchId": "uuid",
  "prospectId": "uuid",
  "subject": "Expanding our partnership with content services",
  "emailBody": "Hi [Name],\n\nI noticed you've been...",
  "talkingPoints": [
    "Natural extension of current SEO work",
    "Already have brand voice documented",
    "Can start with 2 posts/month"
  ]
}
```

#### **Database Changes**

```sql
-- Add to existing prospects table
ALTER TABLE prospects ADD COLUMN health_score INTEGER;
ALTER TABLE prospects ADD COLUMN health_level TEXT;
ALTER TABLE prospects ADD COLUMN last_interaction_date DATE;
ALTER TABLE prospects ADD COLUMN sentiment_trend TEXT;

CREATE INDEX idx_prospects_health ON prospects(health_score);

-- New table for upsell opportunities
CREATE TABLE upsell_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  suggested_service TEXT NOT NULL,
  confidence NUMERIC(3,2),
  reasoning TEXT,
  estimated_value NUMERIC(10,2),
  status TEXT DEFAULT 'detected', -- detected, pitched, accepted, declined
  pitched_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_upsell_opportunities_prospect ON upsell_opportunities(prospect_id);
CREATE INDEX idx_upsell_opportunities_status ON upsell_opportunities(status);
```

#### **Implementation Notes**

- Health score calculation: Weight recent interactions, payment history, sentiment
- Upsell detection: Analyze activity logs for frequently asked topics
- Integrate with time-billing-agent to see service profitability

---

### **Enhancement #2: Bookkeeping-Assistant (A- → A+)**

**Objective:** Add receipt OCR, multi-currency, and report export

#### **New Tools (3 total)**

##### `scan_receipt`

**Description:** Upload receipt image and extract transaction data via OCR
**Inputs:**

- `userId` (string, required)
- `imageBase64` (string, required) - Base64 encoded image (PNG/JPG/PDF)
- `autoCreateTransaction` (boolean, default: true)

**Output:**

```json
{
  "receiptId": "uuid",
  "extracted": {
    "vendor": "Office Depot",
    "amount": 47.82,
    "date": "2025-10-22",
    "category": "office_supplies",
    "taxAmount": 3.82
  },
  "confidence": 0.92,
  "transactionCreated": true,
  "transactionId": "uuid",
  "imageUrl": "https://storage/.../receipt-uuid.png"
}
```

##### `export_report`

**Description:** Generate PDF or Excel financial report
**Inputs:**

- `userId` (string, required)
- `reportType` (enum: 'profit_loss' | 'cash_flow' | 'balance_sheet' | 'tax_summary')
- `startDate` (string, ISO date, required)
- `endDate` (string, ISO date, required)
- `format` (enum: 'pdf' | 'excel' | 'csv', default: 'pdf')

**Output:**

```json
{
  "reportId": "uuid",
  "format": "pdf",
  "downloadUrl": "https://storage/.../report-uuid.pdf",
  "expiresAt": "2025-10-31T23:59:59Z"
}
```

##### `get_audit_trail`

**Description:** View transaction edit history
**Inputs:**

- `transactionId` (string, required)

**Output:**

```json
{
  "transactionId": "uuid",
  "history": [
    {
      "version": 1,
      "changedBy": "user-123",
      "changedAt": "2025-10-20T10:00:00Z",
      "changes": {
        "amount": { "old": 47.82, "new": 50.0 },
        "category": { "old": "supplies", "new": "office_supplies" }
      }
    }
  ]
}
```

#### **Database Changes**

```sql
-- Multi-currency support
ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE transactions ADD COLUMN exchange_rate NUMERIC(10,4);

-- Receipt storage
CREATE TABLE receipt_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  storage_url TEXT,
  image_data BYTEA, -- Optional: store directly
  checksum TEXT NOT NULL, -- SHA-256
  ocr_data JSONB, -- Extracted fields
  ocr_confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipt_attachments_transaction ON receipt_attachments(transaction_id);

-- Audit trail
CREATE TABLE transaction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  changes JSONB NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_transaction ON transaction_audit_log(transaction_id);

-- Report exports
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  file_path TEXT,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_exports_user ON report_exports(user_id);
```

#### **Implementation Notes**

- Use Tesseract.js or Google Vision API for OCR
- Store receipts in database (BYTEA) or external storage (S3/Azure Blob)
- PDF generation: Use PDFKit or Puppeteer
- Excel generation: Use ExcelJS library
- Exchange rates: Fetch from free API (e.g., exchangerate-api.io)

---

### **Enhancement #3: Social-Media-Manager (A → A+)**

**Objective:** Add competitor pricing intelligence

#### **New Tools (2 total)**

##### `monitor_competitor_pricing`

**Description:** Track competitor rates and service offerings
**Inputs:**

- `userId` (string, required)
- `competitorName` (string, required)
- `competitorWebsite` (string, required)
- `servicesToTrack` (array of strings, optional)

**Output:**

```json
{
  "competitorId": "uuid",
  "competitorName": "Jane's Design Studio",
  "services": [
    {
      "serviceName": "Logo Design",
      "priceRange": "$500-$1200",
      "pricingModel": "fixed",
      "lastChecked": "2025-10-24"
    }
  ],
  "priceChanges": [
    {
      "service": "Logo Design",
      "oldPrice": "$400-$1000",
      "newPrice": "$500-$1200",
      "changeDate": "2025-10-15",
      "changePercent": 25
    }
  ]
}
```

##### `analyze_market_position`

**Description:** Compare your rates to competitor averages
**Inputs:**

- `userId` (string, required)
- `service` (string, required)
- `yourPrice` (number, required)

**Output:**

```json
{
  "service": "Logo Design",
  "yourPrice": 800.0,
  "marketAverage": 950.0,
  "marketRange": {
    "low": 500,
    "high": 1500
  },
  "yourPosition": "below_average",
  "recommendation": "You're priced 16% below market average. Consider raising rates to $900-$1000.",
  "competitorCount": 8
}
```

#### **Database Changes**

```sql
CREATE TABLE competitor_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  competitor_website TEXT,
  service_name TEXT NOT NULL,
  price_low NUMERIC(10,2),
  price_high NUMERIC(10,2),
  pricing_model TEXT, -- fixed, hourly, subscription
  currency TEXT DEFAULT 'USD',
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitor_pricing_user ON competitor_pricing(user_id);
CREATE INDEX idx_competitor_pricing_service ON competitor_pricing(service_name);

CREATE TABLE competitor_price_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id UUID REFERENCES competitor_pricing(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  old_price_low NUMERIC(10,2),
  old_price_high NUMERIC(10,2),
  new_price_low NUMERIC(10,2),
  new_price_high NUMERIC(10,2),
  change_percent NUMERIC(5,2),
  change_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_changes_pricing ON competitor_price_changes(pricing_id);
```

#### **Implementation Notes**

- Manual price entry (no web scraping for compliance)
- User-provided competitor data
- Track price changes over time
- Calculate percentiles and market position

---

### **Enhancement #4: Content-Writer (A+ → A++)**

**Objective:** Add knowledge base generation and brand voice profiles

#### **New Tools (3 total)**

##### `generate_kb_article`

**Description:** Create FAQ/help article from Q&A
**Inputs:**

- `userId` (string, required)
- `question` (string, required)
- `context` (string, optional) - Background info
- `format` (enum: 'faq' | 'howto' | 'troubleshooting', default: 'faq')

**Output:**

```json
{
  "articleId": "uuid",
  "title": "How do I reset my password?",
  "content": "# How to Reset Your Password\n\n...",
  "format": "howto",
  "wordCount": 350,
  "readingTime": 2
}
```

##### `save_brand_voice`

**Description:** Store brand voice preferences per client
**Inputs:**

- `userId` (string, required)
- `clientId` (string, required)
- `voiceName` (string, required)
- `tone` (enum: 'professional' | 'casual' | 'witty' | 'authoritative' | 'friendly')
- `vocabularyPreferences` (array of strings, optional) - Preferred terms
- `avoidWords` (array of strings, optional) - Words to avoid
- `sampleText` (string, optional) - Example of desired voice

**Output:**

```json
{
  "voiceProfileId": "uuid",
  "clientId": "client-123",
  "voiceName": "Acme Corp Voice",
  "tone": "professional",
  "created": true
}
```

##### `list_content_templates`

**Description:** Manage reusable content templates
**Inputs:**

- `userId` (string, required)
- `templateType` (enum: 'email' | 'blog' | 'social' | 'newsletter', optional)

**Output:**

```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Product Launch Email",
      "type": "email",
      "variables": ["product_name", "launch_date", "cta_url"],
      "usageCount": 12
    }
  ]
}
```

#### **Implementation Notes**

- No database required (stateless design maintained)
- Store brand voices in local JSON file or optional database
- KB generation uses Anthropic API with structured prompts
- Templates stored as JSON files in module directory

---

### **Enhancement #5: ProspectFinder (A → A)**

**Objective:** Add partnership opportunity detection

#### **New Tools (2 total)**

##### `find_partnership_opportunities`

**Description:** Search for complementary businesses
**Inputs:**

- `userId` (string, required)
- `yourIndustry` (string, required)
- `location` (string, optional)
- `maxResults` (number, default: 20)

**Output:**

```json
{
  "opportunities": [
    {
      "companyName": "Web Hosting Pro",
      "industry": "Web Hosting",
      "synergy": "Complementary to web design services",
      "contactEmail": "partnerships@webhostingpro.com",
      "website": "https://webhostingpro.com"
    }
  ]
}
```

##### `generate_partnership_pitch`

**Description:** Create co-marketing outreach template
**Inputs:**

- `partnerCompany` (string, required)
- `partnerIndustry` (string, required)
- `proposedCollaboration` (string, required)

**Output:**

```json
{
  "subject": "Partnership opportunity: [Your Company] + [Partner]",
  "emailBody": "Hi [Name],\n\nI noticed your work in...",
  "proposedTerms": [
    "Cross-referral agreement",
    "Co-branded content",
    "Joint webinar series"
  ]
}
```

#### **Implementation Notes**

- Leverage existing prospect search infrastructure
- Filter for non-competing, complementary businesses
- Track partnership pipeline separately from sales prospects

---

### **Enhancement #6: VPA-Core (A+ → A++)**

**Objective:** Add operations metrics dashboard

#### **New Tool**

##### `vpa_metrics_dashboard`

**Description:** Consolidated KPIs from all modules
**Inputs:**

- `userId` (string, required)
- `timeframe` (enum: '7d' | '30d' | '90d' | '1y', default: '30d')

**Output:**

```json
{
  "timeframe": "30d",
  "business": {
    "revenue": 25000.0,
    "expenses": 8500.0,
    "profit": 16500.0,
    "profitMargin": 66
  },
  "pipeline": {
    "activeProspects": 23,
    "dealsWon": 5,
    "dealsLost": 2,
    "winRate": 71
  },
  "productivity": {
    "billableHours": 120,
    "nonBillableHours": 20,
    "utilizationRate": 85
  },
  "reputation": {
    "testimonials": 8,
    "publicReviews": 5,
    "avgRating": 4.8
  },
  "anomalies": [
    {
      "metric": "expenses",
      "change": "+45%",
      "severity": "warning",
      "recommendation": "Review recent expense entries for unusual charges"
    }
  ]
}
```

####

---

### **Enhancement #7: Client-Onboarding-Agent (A- → A)**

**Objective:** Add write operations for step completion

#### **New Tools (2 total)**

##### `onboarding_step_complete`

**Description:** Mark onboarding step as completed
**Inputs:**

- `planId` (string, required)
- `stepId` (string, required)
- `completedBy` (string, required)
- `completionNotes` (string, optional)

**Output:**

```json
{
  "stepId": "uuid",
  "status": "completed",
  "completedAt": "2025-10-24T14:30:00Z",
  "planProgress": "65%"
}
```

##### `onboarding_intake_submit`

**Description:** Submit intake response
**Inputs:**

- `intakeRequestId` (string, required)
- `responses` (object, required) - Key-value pairs of field answers

**Output:**

```json
{
  "intakeRequestId": "uuid",
  "status": "submitted",
  "submittedAt": "2025-10-24T14:30:00Z",
  "nextSteps": ["kickoff_scheduling"]
}
```

#### **Database Changes**

```sql
-- Add completion tracking
ALTER TABLE onboarding_plan_steps ADD COLUMN completed_by TEXT;
ALTER TABLE onboarding_plan_steps ADD COLUMN completion_notes TEXT;

-- Intake responses
CREATE TABLE intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intake_responses_request ON intake_responses(intake_request_id);
```

---

## 🚧 REORGANIZATION TASKS

Before building new modules, reorganize existing scattered modules:

### **Task 1: Extract Modules from vpa-core/src/modules/**

Move these to root-level standalone modules:

1. **research-insights.module.ts** → `research-insights/` (NEW standalone)
2. Verify these are wrappers, keep standalone versions:
   - email-orchestrator.module.ts (wrapper for `/email-orchestrator`)
   - lead-tracker.module.ts (wrapper for `/leadtracker-pro`)
   - prospect-finder.module.ts (wrapper for `/prospect-finder`)
   - task-project-manager.module.ts (wrapper for `/task-project-manager`)

### **Task 2: Extract Support Agent**

Move `prospect-finder/src/agents/support-agent.ts` → `support-agent/` at root level

### **Task 3: VPA-Core Refactoring**

After extraction, vpa-core/src/modules/ should contain:

- `catalog.ts` - Module registry
- `registry.ts` - Routing logic
- Thin wrapper modules that delegate to standalone packages via MCP

---

## 📋 BUILD ORDER

### **Phase 1: Reorganization (Codex)**

1. Extract research-insights to root
2. Extract support-agent to root
3. Verify vpa-core modules are delegating wrappers
4. Test all modules still work

### **Phase 2: New Modules (Codex)**

1. Build reputation-review-agent (full implementation)
2. Build time-billing-agent (full implementation)
3. Run smoke tests

### **Phase 3: Enhancements - Critical (Codex)**

1. Enhance bookkeeping-assistant (OCR, multi-currency, exports)
2. Enhance leadtracker-pro (health, upsell detection)
3. Enhance client-onboarding-agent (write operations)

### **Phase 4: Enhancements - Value-Add (Codex)**

1. Enhance content-writer (KB, brand voice)
2. Enhance social-media-manager (competitor pricing)
3. Enhance vpa-core (metrics dashboard)
4. Enhance prospect-finder (partnership tools)

### **Phase 5: Final Integration (Codex + Forge)**

1. Update setup-all.js with all 14 modules
2. Create unified claude_desktop_config.json
3. Forge reviews all implementations
4. Final QA and smoke tests

---

## ✅ ACCEPTANCE CRITERIA

All modules must meet:

- ✅ **Standard structure** (follows directory template)
- ✅ **Database schema** (setup-database.ts working)
- ✅ **Zod validation** (all tool inputs validated)
- ✅ **Error handling** (try-catch with MCP format)
- ✅ **Logging** (Winston structured logs)
- ✅ **README.md** (installation, tools, examples)
- ✅ **Smoke tests** (test-\*.ts scripts pass)
- ✅ **TypeScript strict** (no compilation errors)
- ✅ **Grade A or higher** (Forge review)

---

## 📝 NOTES FOR CODEX

- Use existing modules as templates (leadtracker-pro, bookkeeping-assistant are excellent references)
- Follow the exact database schema provided (don't improvise)
- All MCP tools must return structured JSON (success/error pattern)
- Log every tool execution with `logToolExecution(toolName, params, duration)`
- Test each module standalone before integration
- Commit frequently with clear messages
- Flag any ambiguities for Forge review

---

**END OF SPECIFICATION**

Built with ❤️ by the VPA Team
Target Completion: Current Sprint
