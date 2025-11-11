# VPA Web App Specification
## AI-Powered Dashboard with Custom Widget Marketplace

**Vision:** A revolutionary web dashboard where solopreneurs can visualize all their VPA modules AND build custom widgets/tools through natural language AI commands, then monetize them in a user-generated marketplace.

**Target:** Solopreneurs who want visual dashboards, custom analytics, and no-code customization

**Timeline:** Build AFTER all 14 MCP modules are complete

**Tech Lead:** Codex

**Architecture Review:** Forge

---

## 🚀 Vision & Differentiation

### **The Problem**
- Claude Desktop is powerful but text-only (no visual dashboards)
- Solopreneurs want to SEE their data (charts, metrics, trends)
- Every business has unique needs that generic tools can't solve
- Customization currently requires hiring developers ($$$)

### **The Revolutionary Solution**
A web app that combines:

1. **Unified Dashboard** - All VPA module metrics in one beautiful interface
2. **AI Widget Builder** - Say "I want a widget that shows X" → Claude generates it
3. **AI Tool Builder** - Create custom calculators, processors, analyzers via chat
4. **Marketplace** - Sell your custom widgets to other users ($$$ passive income)
5. **Built-in AI Assistant** - ChatGPT-style interface connected to your entire VPA ecosystem

### **Why This Is Game-Changing**

**No competitor has this:**
- Notion: No AI widget generation
- Airtable: Limited scripting, no marketplace
- Zapier: Automation only, no custom UI
- Monday.com: Pre-built widgets only
- Claude Desktop: Text-only, no visuals

**Network effects:**
- User A builds "Instagram Engagement Analyzer" widget
- Sells it for $5 in marketplace
- 1,000 users buy it → $5,000 passive income for User A
- More users = more widgets = more value = more users 🔄

**Lock-in:**
- Once users build 5-10 custom widgets tailored to their business, switching costs = massive
- Marketplace sellers become advocates (they earn money referring users)

---

## 🎯 Core Features

### **Feature 1: Unified Dashboard (Home)**

**Purpose:** Single-page overview of business health across all modules

#### **Layout Sections**

1. **Hero Metrics** (Top row, 4 cards)
   - Total Revenue (from bookkeeping)
   - Active Clients (from leadtracker)
   - This Month's Hours (from time-billing)
   - Avg Review Rating (from reputation)

2. **Quick Actions** (Floating action bar)
   - Add Time Entry
   - Log Expense
   - Create Task
   - Add Prospect

3. **Module Mini-Dashboards** (Grid, 3x5 layout)
   - ProspectFinder: Scraping queue status
   - LeadTracker: Pipeline funnel chart
   - Time & Billing: Unbilled hours warning
   - Bookkeeping: Cash flow trend (30d)
   - Email Orchestrator: Campaign open rates
   - Task Manager: Today's focus tasks
   - Reputation: Pending testimonial requests
   - Social Media: This week's post schedule
   - Content Writer: Recent content generated
   - Calendar: Upcoming meetings
   - Onboarding: Active client progress
   - Retention: At-risk account alerts
   - Proposal: Pending contract signatures
   - Research: Recent insights

4. **Custom Widget Zone** (Bottom section)
   - User's AI-generated custom widgets
   - Drag-and-drop to rearrange
   - Click "+" to build new widget via AI

#### **Tech Stack**
- **Framework:** Next.js 14 (App Router) with React Server Components
- **UI Library:** Shadcn/ui components
- **Charts:** Recharts + Tremor dashboard components
- **State:** Zustand or React Context
- **API:** TanStack Query (React Query) for data fetching
- **Real-time:** WebSocket connection for live updates

---

### **Feature 2: AI Widget Builder** 🔥🔥🔥

**Purpose:** Let users create custom dashboard widgets via natural language

#### **User Experience Flow**

1. **User clicks "Build Widget" button**
2. **AI Chat Interface Opens:**
   ```
   VPA Builder: What would you like to build?

   User: I want a widget that shows my top 5 clients by revenue this quarter

   VPA Builder: Great! I'll create a bar chart showing:
   - Client names on X-axis
   - Revenue on Y-axis
   - Data from bookkeeping module (last 90 days)
   - Grouped by client_id

   Does that sound right? Any adjustments?

   User: Yes, but make it a donut chart instead

   VPA Builder: Perfect! Generating your widget now...
   [Progress bar: Generating code... Testing... Deploying...]

   ✅ Widget created! It's now in your Custom Widget Zone.
   Would you like to:
   - Publish to Marketplace
   - Keep private
   - Share with specific users
   ```

3. **Widget Appears Instantly** in dashboard
4. **User Can Edit** via chat ("make the colors blue and green")

#### **How It Works Technically**

**Step 1: Intent Analysis**
```typescript
// User input: "Show me top 5 clients by revenue"
const intent = await claudeAPI.analyze({
  prompt: `Parse this widget request:
  "${userInput}"

  Extract:
  - Data source (which VPA module?)
  - Visualization type (chart, table, metric card?)
  - Filters (date range, status, etc.)
  - Aggregation (sum, avg, count?)
  - Sorting/limits

  Return JSON schema.`,
  model: "claude-sonnet-4"
});

// Claude returns:
{
  dataSource: "bookkeeping-assistant",
  query: {
    table: "transactions",
    filters: { type: "income", date: "last_90_days" },
    groupBy: "client_id",
    aggregate: { field: "amount", function: "SUM" },
    orderBy: "total DESC",
    limit: 5
  },
  visualization: {
    type: "donut_chart",
    xAxis: "client_name",
    yAxis: "total_revenue",
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
  }
}
```

**Step 2: Data Fetch**
```typescript
// VPA API fetches data from appropriate module
const data = await vpaAPI.query({
  module: "bookkeeping-assistant",
  tool: "generate_report",
  params: {
    reportType: "custom",
    query: intent.query
  }
});

// Returns:
{
  results: [
    { client_name: "Acme Corp", total_revenue: 15000 },
    { client_name: "TechStart Inc", total_revenue: 12000 },
    // ...
  ]
}
```

**Step 3: Component Generation**
```typescript
// Claude generates React component code
const componentCode = await claudeAPI.generate({
  prompt: `Generate a React component for this widget:

  Intent: ${JSON.stringify(intent)}
  Data Schema: ${JSON.stringify(data)}

  Requirements:
  - Use Recharts library
  - Use Shadcn/ui Card wrapper
  - TypeScript strict mode
  - Responsive design
  - Error handling
  - Loading states
  - Tooltip on hover

  Return ONLY the component code, no explanations.`,
  model: "claude-sonnet-4"
});

// Claude returns:
`
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface TopClientsWidgetProps {
  data: Array<{ client_name: string; total_revenue: number }>;
}

export function TopClientsWidget({ data }: TopClientsWidgetProps) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Clients by Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total_revenue"
              nameKey="client_name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => \`$\${value.toLocaleString()}\`} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
`
```

**Step 4: Validation & Sandboxing**
```typescript
// Validate generated code for security
const validation = await validateComponent(componentCode);

if (!validation.safe) {
  throw new Error(`Unsafe code detected: ${validation.issues}`);
}

// Compile TypeScript
const compiled = await compileTypeScript(componentCode);

// Store in database
const widget = await db.widgets.create({
  userId: user.id,
  name: "Top 5 Clients by Revenue",
  componentCode: componentCode,
  compiledCode: compiled,
  dataSource: intent.dataSource,
  dataQuery: intent.query,
  visualization: intent.visualization,
  version: 1,
  status: "active"
});
```

**Step 5: Dynamic Rendering**
```typescript
// Frontend dynamically renders widget
import dynamic from 'next/dynamic';

const DynamicWidget = dynamic(() =>
  import(`@/widgets/${widget.id}`),
  { loading: () => <WidgetSkeleton /> }
);

<DynamicWidget data={fetchedData} />
```

#### **Safety & Security**

**Code Validation Rules:**
- ✅ Only allow approved imports (Recharts, Shadcn, React)
- ✅ No `eval()`, `Function()`, or dynamic code execution
- ✅ No network requests (fetch, axios) - data must come from props
- ✅ No file system access
- ✅ No DOM manipulation outside component scope
- ✅ TypeScript strict mode enforced
- ✅ ESLint + security rules
- ✅ Maximum complexity score limit

**Sandboxing:**
- Widgets run in isolated iframe with sandbox attributes
- Content Security Policy headers
- No access to cookies, localStorage, or sensitive APIs
- Data passed via `postMessage` API only

**Rate Limiting:**
- Max 10 widget generations per day (Basic tier)
- Max 50 widget generations per day (Pro tier)
- Prevents abuse and excessive Claude API costs

---

### **Feature 3: AI Tool Builder** 🔥

**Purpose:** Create custom calculation/processing tools (not just visualizations)

#### **Examples**

**Example 1: ROI Calculator**
```
User: Build me a tool that calculates ROI on my marketing campaigns

VPA Builder: I'll create an ROI calculator that takes:
- Campaign cost (from bookkeeping expenses)
- Revenue generated (from leadtracker conversions)
- Time invested (from time-billing)

Returns:
- ROI percentage
- Payback period
- Cost per acquisition

Generating tool...

✅ Done! Your "Marketing ROI Calculator" is ready.
Use it from Tools menu or Quick Actions.
```

**Example 2: Client Profitability Analyzer**
```
User: I need a tool that tells me which clients are most profitable

VPA Builder: Creating profitability analyzer that:
- Pulls time entries from time-billing
- Pulls invoices from bookkeeping
- Calculates: (Revenue - Time Cost) / Hours Spent
- Ranks clients by profit margin
- Identifies unprofitable clients (margin < 20%)

✅ Created! It's now in Tools > Analysis.
```

**Example 3: Content Performance Scorer**
```
User: Build a tool that scores my blog posts by engagement

VPA Builder: I'll create a scoring algorithm using:
- Social media shares (from social-media-manager)
- Email click rates (from email-orchestrator)
- Lead generation (from prospect-finder attribution)

Weighted formula:
- Shares: 40%
- Clicks: 35%
- Leads: 25%

Returns 0-100 score with recommendations.

✅ Tool ready! It's in Tools > Content Analysis.
```

#### **Tech Implementation**

Tools are stored as **serverless functions** in the VPA backend:

```typescript
// Generated tool code
export async function calculateMarketingROI(params: {
  campaignId: string;
  userId: string;
}): Promise<ROIResult> {
  // Fetch campaign expenses
  const expenses = await vpaAPI.bookkeeping.getExpenses({
    category: "marketing",
    metadata: { campaign_id: params.campaignId }
  });

  // Fetch attributed revenue
  const revenue = await vpaAPI.leadtracker.getConversions({
    source: params.campaignId
  });

  // Fetch time invested
  const timeEntries = await vpaAPI.timeBilling.getEntries({
    projectName: `Campaign: ${params.campaignId}`
  });

  const totalCost = expenses.total + (timeEntries.totalHours * 100); // Assume $100/hr
  const totalRevenue = revenue.total;
  const roi = ((totalRevenue - totalCost) / totalCost) * 100;
  const paybackPeriod = totalCost / (totalRevenue / 30); // days
  const cpa = totalCost / revenue.count;

  return {
    roi: Math.round(roi * 100) / 100,
    paybackPeriodDays: Math.round(paybackPeriod),
    costPerAcquisition: Math.round(cpa * 100) / 100,
    totalInvested: totalCost,
    totalReturned: totalRevenue,
    recommendation: roi > 100
      ? "Excellent ROI! Scale this campaign."
      : roi > 50
      ? "Good ROI. Monitor and optimize."
      : "Low ROI. Consider reducing spend or improving targeting."
  };
}
```

---

### **Feature 4: Widget Marketplace** 🔥💰

**Purpose:** Users can publish and sell their custom widgets

#### **Marketplace Features**

**For Buyers:**
- Browse widgets by category (Analytics, Charts, Tools, Calculators)
- Filter by module (LeadTracker widgets, Bookkeeping widgets, etc.)
- Sort by: Most Popular, Highest Rated, Newest, Price
- Preview widget with sample data
- One-click install
- Ratings & reviews
- Free and paid widgets

**For Sellers:**
- Publish widgets with description, screenshots, pricing
- Set pricing: Free, $1.99, $4.99, $9.99, $19.99
- Earn 70% revenue share (VPA takes 30%)
- Analytics dashboard: views, installs, revenue
- Update widgets (versioning)
- Respond to reviews
- Promote via affiliate links

#### **Widget Listing Schema**

```typescript
interface MarketplaceWidget {
  id: string;
  creatorUserId: string;
  creatorName: string;
  creatorAvatar: string;

  name: string;
  description: string;
  longDescription: string; // Markdown
  category: 'analytics' | 'charts' | 'tools' | 'calculators';
  tags: string[];

  moduleCompatibility: string[]; // ['leadtracker-pro', 'bookkeeping-assistant']

  pricing: {
    type: 'free' | 'paid';
    price: number; // in cents
    currency: 'USD';
  };

  media: {
    icon: string; // URL
    screenshots: string[];
    demoVideo: string; // optional
  };

  stats: {
    installs: number;
    activeUsers: number;
    avgRating: number;
    reviewCount: number;
    revenue: number; // lifetime revenue
  };

  versions: WidgetVersion[];
  currentVersion: string;

  status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'suspended';

  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
}
```

#### **Revenue Model**

**Marketplace Economics:**
- Widget priced at $4.99
- Buyer pays $4.99
- VPA takes 30% = $1.50 (platform fee)
- Creator gets 70% = $3.49
- Payment processor fee (Stripe): ~$0.30 (deducted from VPA's share)

**Creator Earnings Example:**
- Widget priced at $9.99
- 500 installs/month
- Gross: $4,995
- Creator net: $3,496.50/month
- Passive income while building their own business!

**VPA Benefits:**
- 30% platform fee
- More widgets = more value = more Pro subscribers
- Creators become advocates (they want more users to sell to)
- Network effects accelerate growth

#### **Review & Approval Process**

**Automated Checks:**
1. Security scan (no malicious code)
2. Performance test (render time < 2 seconds)
3. Data privacy check (no data exfiltration)
4. TypeScript compilation success
5. ESLint pass (no critical issues)

**Manual Review (if needed):**
- VPA team reviews widgets flagged by automated checks
- Verify widget description is accurate
- Test with real VPA data
- Approve or reject with feedback

**Quality Standards:**
- Widgets must be useful and functional
- No spam or duplicate functionality
- Must respect user data privacy
- No excessive API calls (rate limit compliance)

---

### **Feature 5: Module-Specific Dashboards**

**Purpose:** Deep-dive views for each VPA module

#### **Example: LeadTracker Pro Dashboard**

**Layout:**
1. **Pipeline Visualization**
   - Funnel chart (new → qualified → proposal → won/lost)
   - Drag-and-drop to move prospects between stages
   - Click to view prospect detail panel

2. **Health Monitoring**
   - At-risk clients list (red flags)
   - Health score distribution chart
   - Upsell opportunity alerts

3. **Activity Timeline**
   - Recent interactions with clients
   - Follow-up tasks due today
   - Completed activities log

4. **Performance Metrics**
   - Win rate
   - Average deal size
   - Sales cycle length
   - Conversion rates by stage

5. **Quick Actions**
   - Add new prospect
   - Log activity
   - Update status
   - Schedule follow-up

#### **Example: Time & Billing Dashboard**

**Layout:**
1. **Unbilled Hours Alert**
   - Big warning card if > 40 hours unbilled
   - "Generate Invoice" CTA button

2. **Time Tracking Widget**
   - Active timer (Pomodoro-style)
   - Today's logged hours
   - This week summary

3. **Invoice Status Board**
   - Columns: Draft, Sent, Overdue, Paid
   - Drag-and-drop cards
   - Click to view/edit invoice

4. **Revenue Chart**
   - Line chart: Revenue over time
   - Compare: Invoiced vs Paid vs Outstanding

5. **Client Profitability Table**
   - Sortable table with all clients
   - Columns: Hours, Billed, Paid, Margin, Status

---

### **Feature 6: Built-in AI Assistant**

**Purpose:** ChatGPT-style interface connected to entire VPA ecosystem

#### **User Experience**

**Chat Interface (Right sidebar, always accessible):**
```
User: How much revenue did I make last month?

VPA AI: Let me check your bookkeeping data...
✅ In September 2025, you earned $12,450 in revenue.

Breakdown:
- Client payments: $9,800
- Project deposits: $2,650

Your expenses were $3,200, giving you a net profit of $9,250.

Would you like me to generate a detailed P&L report?

---

User: Yes, and also show me which clients I haven't contacted in 30 days

VPA AI: Generating September P&L report...
✅ Report ready (opens in new tab)

Checking LeadTracker for inactive clients...
✅ Found 3 clients with no contact in 30+ days:

1. Acme Corp (Last contact: Aug 15, 2025 - 45 days ago)
   Suggestion: Send check-in email

2. TechStart Inc (Last contact: Aug 22, 2025 - 38 days ago)
   Suggestion: Schedule coffee chat

3. Blue Widgets (Last contact: Aug 10, 2025 - 50 days ago)
   ⚠️ Warning: This is a high-value client ($15k/year)

Would you like me to draft outreach emails?
```

#### **AI Capabilities**

**Data Queries:**
- "What's my cash flow for Q3?"
- "Show me all overdue invoices"
- "Which prospects are in the proposal stage?"

**Actions:**
- "Create a task to call John tomorrow at 2pm"
- "Log 3 hours on the Acme website project"
- "Send payment reminder to TechStart Inc"

**Analysis:**
- "Which marketing channel gives me the best ROI?"
- "Am I on track to hit my revenue goal?"
- "What's my average client lifetime value?"

**Recommendations:**
- "What should I focus on today?"
- "Which clients should I upsell?"
- "Am I undercharging based on market rates?"

**AI Tool Invocation:**
- User: "Calculate ROI on my Facebook ads campaign"
- AI: "Using your Marketing ROI Calculator tool..."
- Returns results with charts

---

## 📐 Technical Architecture

### **Tech Stack**

#### **Frontend**
```
Framework:     Next.js 14 (App Router, React Server Components)
Language:      TypeScript (strict mode)
UI Library:    Shadcn/ui + Radix UI primitives
Styling:       Tailwind CSS
Charts:        Recharts + Tremor
State:         Zustand (client state) + React Query (server state)
Forms:         React Hook Form + Zod validation
Auth:          Clerk (or Auth0)
Deployment:    Vercel (or Cloudflare Pages)
```

#### **Backend (VPA API Gateway)**
```
Framework:     Express.js (Node.js)
Language:      TypeScript
API Style:     REST + GraphQL (Apollo Server)
Database:      PostgreSQL (Neon or Supabase)
ORM:           Prisma
Auth:          JWT + API keys
File Storage:  AWS S3 (or Cloudflare R2)
Cache:         Redis (Upstash)
Jobs:          BullMQ (background tasks)
Deployment:    Railway (or Render)
```

#### **AI Services**
```
LLM:           Claude API (Anthropic) - Sonnet 4
Code Gen:      Claude for React component generation
Validation:    ESLint + Custom security rules
Sandbox:       VM2 or isolated-vm
Embeddings:    (optional) For semantic widget search
```

#### **Payments**
```
Processor:     Stripe
Subscriptions: Stripe Subscriptions (Basic/Pro)
Marketplace:   Stripe Connect (for payouts to creators)
```

### **Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                     VPA Web App (Next.js)                    │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  Unified   │  │  Module    │  │  Widget    │             │
│  │ Dashboard  │  │ Dashboards │  │ Marketplace│             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                                                               │
│  ┌────────────────────────────────────────────────┐          │
│  │        AI Assistant (Chat Interface)           │          │
│  └────────────────────────────────────────────────┘          │
│                                                               │
│  ┌────────────────────────────────────────────────┐          │
│  │      Widget Builder (AI Code Generation)       │          │
│  └────────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   VPA API Gateway (Express)                  │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │   Auth     │  │  GraphQL   │  │    REST    │             │
│  │   Layer    │  │    API     │  │    API     │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                                                               │
│  ┌────────────────────────────────────────────────┐          │
│  │       Module Router (MCP Orchestrator)         │          │
│  └────────────────────────────────────────────────┘          │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  Widget    │  │  Claude    │  │  Stripe    │             │
│  │  Compiler  │  │    API     │  │    API     │             │
│  └────────────┘  └────────────┘  └────────────┘             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     14 VPA Modules (MCP)                     │
│                                                               │
│  prospect-finder    leadtracker-pro    bookkeeping-assistant │
│  time-billing       email-orchestrator task-project-manager  │
│  reputation-review  social-media       content-writer        │
│  calendar-meeting   client-onboarding  retention-renewal     │
│  proposal-contract  support-agent                            │
└─────────────────────────────────────────────────────────────┘
```

### **Database Schema (Web App)**

```sql
-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'basic', -- basic, pro
  subscription_status TEXT DEFAULT 'active', -- active, cancelled, expired
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module Access (what modules user has enabled)
CREATE TABLE user_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL, -- 'leadtracker-pro', 'bookkeeping-assistant', etc.
  enabled BOOLEAN DEFAULT true,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_module_access_user ON user_module_access(user_id);

-- Custom Widgets (AI-generated)
CREATE TABLE widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'analytics', 'charts', 'tools', 'calculators'

  component_code TEXT NOT NULL, -- React component source
  compiled_code TEXT NOT NULL, -- Bundled JS

  data_source TEXT NOT NULL, -- Module name
  data_query JSONB NOT NULL, -- Query params
  visualization JSONB, -- Chart config

  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active, archived

  is_public BOOLEAN DEFAULT false,
  marketplace_listing_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widgets_user ON widgets(user_id);
CREATE INDEX idx_widgets_public ON widgets(is_public);

-- Widget Usage (for analytics)
CREATE TABLE widget_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  render_count INTEGER DEFAULT 0,
  last_rendered_at TIMESTAMPTZ,
  avg_render_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widget_usage_widget ON widget_usage(widget_id);

-- Marketplace Listings
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  creator_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT, -- Markdown

  category TEXT NOT NULL,
  tags TEXT[],

  pricing_type TEXT NOT NULL, -- 'free', 'paid'
  price_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',

  icon_url TEXT,
  screenshots TEXT[],
  demo_video_url TEXT,

  install_count INTEGER DEFAULT 0,
  active_user_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  lifetime_revenue_cents INTEGER DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft', -- draft, under_review, approved, rejected, suspended

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketplace_creator ON marketplace_listings(creator_user_id);
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_category ON marketplace_listings(category);

-- Marketplace Installs
CREATE TABLE marketplace_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE, -- Cloned instance

  purchase_type TEXT NOT NULL, -- 'free', 'paid'
  amount_paid_cents INTEGER DEFAULT 0,
  stripe_payment_intent_id TEXT,

  installed_at TIMESTAMPTZ DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ
);

CREATE INDEX idx_installs_listing ON marketplace_installs(listing_id);
CREATE INDEX idx_installs_user ON marketplace_installs(user_id);

-- Marketplace Reviews
CREATE TABLE marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,

  helpful_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_listing ON marketplace_reviews(listing_id);
CREATE INDEX idx_reviews_user ON marketplace_reviews(user_id);

-- Creator Payouts
CREATE TABLE creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  total_sales_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL, -- 30%
  payout_amount_cents INTEGER NOT NULL, -- 70%

  stripe_payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed

  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_creator ON creator_payouts(creator_user_id);
CREATE INDEX idx_payouts_status ON creator_payouts(status);

-- Dashboard Layouts (user customization)
CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  layout_type TEXT NOT NULL DEFAULT 'unified', -- unified, module_specific
  module_name TEXT, -- if module_specific

  grid_config JSONB NOT NULL, -- Widget positions, sizes

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layouts_user ON dashboard_layouts(user_id);
```

---

## 🔒 Security & Compliance

### **Widget Security**

**Code Validation:**
```typescript
// Security rules enforced during widget generation
const SECURITY_RULES = {
  allowedImports: [
    'react',
    'recharts',
    '@/components/ui/*',
    'date-fns',
    'lodash',
  ],
  forbiddenPatterns: [
    /eval\(/,
    /Function\(/,
    /document\./,
    /window\./,
    /fetch\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /__dirname/,
    /__filename/,
    /process\.env/,
    /require\(/,
  ],
  maxComplexity: 50, // Cyclomatic complexity
  maxLines: 500,
  maxRenderTime: 2000, // ms
};
```

**Runtime Sandboxing:**
```typescript
// Widgets run in isolated sandbox
<iframe
  sandbox="allow-scripts allow-same-origin"
  src={`/widget-sandbox/${widget.id}`}
  style={{ width: '100%', height: '400px', border: 'none' }}
/>
```

**Content Security Policy:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.vpa.com;
  frame-ancestors 'none';
```

### **Data Privacy**

- User data never leaves VPA infrastructure
- Widgets cannot make external network calls
- All data access logged and auditable
- GDPR/CCPA compliant data handling
- Users can delete all custom widgets and data anytime

### **Marketplace Safety**

- All listings reviewed before approval
- Malicious widgets result in account suspension
- Rating/review system to flag bad actors
- Refund policy for purchased widgets (7-day window)
- Escrow payments (payout after 30-day return window)

---

## 📅 Implementation Phases

### **Phase 1: Foundation (Weeks 1-3)**
**Build:** Next.js app + VPA API Gateway + Authentication

- [ ] Next.js 14 app with Shadcn/ui
- [ ] User authentication (Clerk)
- [ ] Database schema + Prisma ORM
- [ ] VPA API Gateway (Express)
- [ ] MCP module connectors
- [ ] Subscription management (Stripe)

**Deliverable:** Users can log in, see empty dashboard, connect VPA modules

---

### **Phase 2: Unified Dashboard (Weeks 4-5)**
**Build:** Home dashboard with module mini-cards

- [ ] Hero metrics (4 cards)
- [ ] Quick actions floating bar
- [ ] Module mini-dashboards (14 cards)
- [ ] Real-time data fetching from all modules
- [ ] Responsive grid layout
- [ ] Loading skeletons

**Deliverable:** Users see live data from all enabled modules

---

### **Phase 3: Module-Specific Dashboards (Weeks 6-8)**
**Build:** Deep-dive views for each module

- [ ] LeadTracker dashboard (pipeline, health, activities)
- [ ] Time & Billing dashboard (timer, invoices, profitability)
- [ ] Bookkeeping dashboard (cash flow, expenses, reports)
- [ ] Reputation dashboard (testimonials, reviews, stats)
- [ ] Other module dashboards (simplified views)

**Deliverable:** Users can drill down into any module

---

### **Phase 4: AI Widget Builder 🔥 (Weeks 9-12)**
**Build:** Natural language widget generation

- [ ] AI chat interface (Claude API integration)
- [ ] Intent parsing (data source, viz type, filters)
- [ ] Data fetching from VPA modules
- [ ] React component code generation
- [ ] TypeScript compilation & validation
- [ ] Security scanning
- [ ] Sandboxed rendering
- [ ] Widget storage & versioning
- [ ] Drag-and-drop dashboard customization

**Deliverable:** Users can build custom widgets via chat

---

### **Phase 5: AI Tool Builder (Weeks 13-14)**
**Build:** Custom calculation/analysis tools

- [ ] Tool generation (serverless functions)
- [ ] Parameter input forms
- [ ] Result visualization
- [ ] Tool library (user's tools)
- [ ] Sharing tools (private/team)

**Deliverable:** Users can create custom analysis tools

---

### **Phase 6: Marketplace (Weeks 15-18)**
**Build:** Widget marketplace with payments

- [ ] Marketplace browse UI (categories, search, filters)
- [ ] Widget detail pages
- [ ] Publishing flow (screenshots, description, pricing)
- [ ] Stripe Connect integration (for creators)
- [ ] Purchase flow (free & paid)
- [ ] Review & rating system
- [ ] Creator dashboard (revenue, stats)
- [ ] Payout automation (monthly)

**Deliverable:** Users can buy/sell widgets

---

### **Phase 7: AI Assistant (Weeks 19-20)**
**Build:** ChatGPT-style interface

- [ ] Chat sidebar (always accessible)
- [ ] Natural language data queries
- [ ] Action execution (create task, log time, etc.)
- [ ] Analysis & recommendations
- [ ] Tool invocation from chat
- [ ] Conversation history

**Deliverable:** Users can interact with VPA via chat

---

### **Phase 8: Polish & Launch (Weeks 21-22)**
**Build:** Performance, SEO, onboarding

- [ ] Performance optimization (lazy loading, code splitting)
- [ ] SEO & meta tags
- [ ] Onboarding tour for new users
- [ ] Help documentation
- [ ] Mobile responsiveness
- [ ] Error monitoring (Sentry)
- [ ] Analytics (PostHog)

**Deliverable:** Production-ready web app

---

## 💰 Business Model & Pricing

### **Subscription Tiers**

| Feature | Basic ($49/mo) | Pro ($99/mo) |
|---------|----------------|---------------|
| VPA Modules | 8 modules | All 14 modules |
| Unified Dashboard | ✅ | ✅ |
| Module Dashboards | ✅ | ✅ |
| AI Widget Builder | 10 widgets/day | 50 widgets/day |
| AI Tool Builder | 5 tools/day | 20 tools/day |
| Custom Widgets Storage | 20 widgets | Unlimited |
| Marketplace Access | ✅ Buy only | ✅ Buy & Sell |
| AI Assistant | 100 msgs/day | 500 msgs/day |
| Data Retention | 1 year | Unlimited |
| Priority Support | ❌ | ✅ |
| Advanced Analytics | ❌ | ✅ |

### **Marketplace Revenue**

**Creator Economics:**
- 70% to widget creator
- 30% to VPA platform
- Minimum price: $1.99
- Maximum price: $49.99
- Payouts: Monthly (net-30)

**VPA Revenue Projections:**
- 10,000 users × $49/mo = $490,000/mo (Basic tier)
- 2,000 users × $99/mo = $198,000/mo (Pro tier)
- Marketplace (30% of $50k/mo widget sales) = $15,000/mo
- **Total MRR: $703,000/month**

---

## 🚀 Launch Strategy

### **Beta Launch (3 months)**
- Invite 100 existing Claude Desktop users
- Free Pro tier for beta testers
- Collect feedback on widget builder
- Iterate on AI prompts and UX

### **Public Launch**
- Product Hunt launch
- Content marketing (blog, YouTube tutorials)
- Affiliate program (20% commission for referrals)
- Creator spotlight (feature top marketplace sellers)

### **Growth Levers**
1. **Marketplace network effects** - More creators = more value
2. **Creator advocacy** - Sellers promote VPA to grow their market
3. **Viral widgets** - "Built with VPA" badge on shared widgets
4. **SEO** - Widget listings indexed by Google
5. **Community** - Discord for widget builders

---

## ✅ Success Metrics

### **Key Performance Indicators (KPIs)**

**User Engagement:**
- Daily active users (DAU)
- Avg session duration
- Widgets created per user
- Widgets used per session

**Marketplace:**
- Total widget listings
- Free vs paid ratio
- Average widget price
- Monthly marketplace GMV (Gross Merchandise Value)
- Creator earnings (total paid out)

**Revenue:**
- MRR (Monthly Recurring Revenue)
- Churn rate (target: < 5%)
- Conversion rate (Basic → Pro)
- LTV/CAC ratio (target: > 3)

**AI Performance:**
- Widget generation success rate (target: > 90%)
- Avg generation time (target: < 30 seconds)
- User satisfaction with generated widgets (target: > 4/5 stars)

---

## 🎯 Competitive Advantages

### **Why VPA Web App Wins:**

1. **AI-Generated Widgets** 🔥
   - No competitor has this
   - Solopreneurs get custom tools without hiring devs
   - Infinite customization

2. **Integrated Ecosystem**
   - 14 modules all in one place
   - Claude Desktop + Web app = best of both worlds
   - Data flows seamlessly between modules

3. **Marketplace Network Effects**
   - Buyers want more widgets → attract more creators
   - Creators want more buyers → bring their audience
   - Flywheel accelerates growth

4. **Built-in AI Assistant**
   - Not a separate chat app
   - Connected to all user's data
   - Can take actions, not just answer questions

5. **Solopreneur-First Design**
   - Not enterprise bloat
   - Affordable pricing
   - Features that solve real solo pain points

---

## 📝 Technical Notes for Codex

### **AI Code Generation Best Practices**

**Prompt Structure:**
```typescript
const WIDGET_GENERATION_PROMPT = `
You are an expert React developer building dashboard widgets.

USER REQUEST: "${userInput}"

AVAILABLE DATA SOURCES:
${JSON.stringify(availableModules)}

TASK:
1. Parse user intent (data source, viz type, filters)
2. Generate TypeScript React component using:
   - Recharts for charts
   - Shadcn/ui for Card wrapper
   - Proper TypeScript types
   - Error handling
   - Loading states

3. Component must:
   - Accept data via props (no API calls inside)
   - Be fully self-contained
   - Have no side effects
   - Render in < 2 seconds

4. Return ONLY the component code, no explanations.

EXAMPLE OUTPUT:
\`\`\`typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface WidgetProps {
  data: Array<{ name: string; value: number }>;
}

export function CustomWidget({ data }: WidgetProps) {
  return (
    <Card>
      <CardHeader><CardTitle>Widget Title</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
\`\`\`
`;
```

**Error Handling:**
- Always validate generated code before execution
- Fallback to pre-built templates if AI generation fails
- Show clear error messages to users
- Log failures for continuous improvement

**Performance:**
- Cache compiled widgets (Redis)
- Lazy load widget code (dynamic imports)
- Prefetch popular marketplace widgets
- Limit concurrent AI generations per user

---

## 🎬 Conclusion

This web app transforms VPA from a powerful CLI tool into a **visual, customizable, marketplace-driven platform** that:

1. ✅ Solves the "Claude Desktop is text-only" limitation
2. ✅ Enables infinite customization without code
3. ✅ Creates network effects through marketplace
4. ✅ Generates passive income for creators
5. ✅ Locks in users through custom widgets
6. ✅ Differentiates from every competitor

**This is the killer feature that makes VPA a category-defining product.**

---

**Next Steps:**
1. Forge reviews this spec
2. User approves vision and scope
3. Codex begins Phase 1 implementation
4. Iterate based on beta feedback

**Let's build something revolutionary.** 🚀

---

**Built with ❤️ by the VPA Team**
**Target Launch:** Q2 2026
