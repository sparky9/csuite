# EmailOrchestrator Integration Examples

**Real-world workflows combining all three MCPs**

## Complete Lead Gen Workflow

### Scenario: Find CTOs at SaaS companies, qualify them, and run email campaign

```
1. SCRAPE PROSPECTS (ProspectFinder)
===================================

"Use prospect-finder to scrape 50 CTOs at SaaS companies in the USA"

Result: 50 prospects added to database


2. QUALIFY PROSPECTS (LeadTracker Pro)
======================================

"Use leadtracker-pro to move these prospects through the pipeline:
- Tag them as 'saas' and 'cto'
- Set status to 'new'
- Add note: 'Q4 2024 SaaS outreach'"

Result: Prospects tagged and organized


3. RESEARCH TOP PROSPECTS
=========================

"For the top 10 prospects, enrich their data with company information"

Result: Enhanced prospect profiles


4. CREATE EMAIL CAMPAIGN (EmailOrchestrator)
===========================================

"Use email-orchestrator to create a campaign:
- Name: Q4 CTO Outreach
- From: mike@example.com
- Target prospects with tags: ['saas', 'cto']
- Send weekdays 9-5 PM Central time"

Result: Campaign created (draft status)


5. ADD EMAIL SEQUENCE
=====================

Email 1 (Day 0):
"Add first email to the campaign:
- Subject: Quick question about {{company}}
- Body: Professional introduction mentioning their role as CTO
- Use AI personalization"

Email 2 (Day 3):
"Add follow-up email:
- Subject: Following up - {{company}}
- Body: Brief value proposition
- Reference their industry"

Email 3 (Day 7):
"Add final touchpoint:
- Subject: Last try - {{first_name}}
- Body: Clear call-to-action for 15-min call"


6. START CAMPAIGN
=================

"Start the Q4 CTO Outreach campaign"

Result: 50 prospects enrolled, emails scheduled


7. MONITOR PERFORMANCE
======================

"Show me stats for the Q4 CTO Outreach campaign"

Result:
- 50 emails sent
- 22 opens (44% open rate)
- 5 clicks (10% click rate)
- 2 replies (4% reply rate)


8. MANAGE REPLIES
=================

When a prospect replies, EmailOrchestrator automatically pauses them.

"Use leadtracker-pro to move replied prospects to 'in_conversation' status"


9. FOLLOW UP MANUALLY
=====================

"Show me email history for prospect [ID] so I can see our conversation"

"Use email-orchestrator to send a personalized reply to [email]"


10. TRACK TO CLOSE
==================

"Use leadtracker-pro to move prospects through pipeline as they progress:
- in_conversation → qualified → proposal → closed_won"
```

## Campaign Templates

### Template 1: Cold Outreach Sequence

```
Campaign: "Cold Outreach - Tech Decision Makers"

Email 1 (Day 0): Introduction
------------------------------
Subject: Quick question about {{company}}'s tech stack
Body:
Hi {{first_name}},

I noticed {{company}} is in the {{industry}} space and thought you might be interested in how we help companies like yours streamline their operations.

Would you be open to a quick 15-minute conversation?

Best,
Mike

Email 2 (Day 3): Value Proposition
-----------------------------------
Subject: Helping {{company}} save time
Body:
Hi {{first_name}},

Following up on my previous email. We've helped {{industry}} companies reduce operational overhead by 40%.

Would love to show you how this could work for {{company}}.

Best,
Mike

Email 3 (Day 7): Case Study
----------------------------
Subject: [Case Study] {{company}} + Similar Company
Body:
{{first_name}},

Quick share: We recently worked with [Similar Company] in {{industry}} and achieved [specific results].

Worth a conversation?

Best,
Mike
```

### Template 2: Warm Follow-Up Sequence

```
Campaign: "Conference Follow-Up"

Email 1 (Day 0): Immediate Follow-Up
-------------------------------------
Subject: Great meeting you at [Event]
Body:
Hi {{first_name}},

Really enjoyed our conversation at [Event] yesterday. As promised, here's more info about how we help {{industry}} companies.

[Link to resource]

Let's schedule that call we discussed?

Best,
Mike

Email 2 (Day 2): Scheduling
----------------------------
Subject: Calendar link - {{company}}
Body:
{{first_name}},

Here's my calendar link to make scheduling easier:
[Calendar link]

Looking forward to diving deeper into how we can help {{company}}.

Best,
Mike
```

### Template 3: Re-engagement Campaign

```
Campaign: "Re-engage Cold Prospects"

Email 1 (Day 0): Break the Ice
-------------------------------
Subject: {{first_name}}, still relevant?
Body:
Hi {{first_name}},

It's been a while since we last connected. I wanted to check if [value proposition] is still relevant for {{company}}.

If not, no worries - just let me know and I'll stop bothering you!

Best,
Mike

Email 2 (Day 5): New Development
---------------------------------
Subject: New: [Feature] for {{industry}}
Body:
{{first_name}},

Quick update: We just launched [new feature] specifically for {{industry}} companies like {{company}}.

Thought you might want to see it: [link]

Best,
Mike
```

## Advanced Workflows

### Multi-Segment Campaign

```
# Segment 1: High-Value Prospects
Campaign: "Enterprise Outreach"
- Target: Companies > 500 employees
- Personalization: Deep research, custom value props
- Sequence: 5 emails over 3 weeks
- From: CEO's email

# Segment 2: Mid-Market
Campaign: "Mid-Market Outreach"
- Target: Companies 50-500 employees
- Personalization: AI-generated, industry-specific
- Sequence: 3 emails over 10 days
- From: Sales email

# Segment 3: SMB
Campaign: "SMB Quick Touch"
- Target: Companies < 50 employees
- Personalization: Template-based with variables
- Sequence: 2 emails over 5 days
- From: Support email
```

### A/B Testing Subject Lines

```
# Create campaign with subject variants

"Add email sequence with multiple subject line variants:
- Subject variant 1: Quick question about {{company}}
- Subject variant 2: {{first_name}}, thought you'd be interested
- Subject variant 3: Improving {{industry}} operations"

# EmailOrchestrator will randomly assign variants
# Track performance in campaign stats
```

### Trigger-Based Sequences

```
# Scenario: Prospect downloads a resource

1. LeadTracker Pro: Tag prospect as "downloaded_whitepaper"

2. EmailOrchestrator: Create nurture campaign targeting "downloaded_whitepaper"

Email 1 (Day 1): Thank you + additional resources
Email 2 (Day 4): Case study related to whitepaper topic
Email 3 (Day 7): Offer for demo/consultation
```

## Integration Patterns

### Pattern 1: Scrape → Qualify → Email

```javascript
// 1. Scrape prospects
const prospects = await scrape_apollo_io({
  search_query: "CTO at SaaS companies",
  limit: 100
});

// 2. Auto-qualify based on criteria
await bulk_update_prospects({
  prospect_ids: prospects.filter(p => p.company_size === "51-200").map(p => p.id),
  updates: { status: "qualified", tags: ["saas", "mid-market"] }
});

// 3. Create targeted campaign
const campaign = await create_campaign({
  name: "Mid-Market SaaS CTOs",
  target_tags: ["saas", "mid-market", "qualified"]
});

await add_email_sequence({ ... });
await start_campaign({ campaign_id: campaign.id });
```

### Pattern 2: Pipeline-Based Triggers

```javascript
// When prospect moves to "qualified" in LeadTracker...
// Automatically enroll in email campaign

// 1. Prospect reaches "qualified" status
await update_prospect_status({
  prospect_id: "...",
  status: "qualified"
});

// 2. EmailOrchestrator campaign targets "qualified" status
const campaign = await create_campaign({
  target_status: "qualified"  // Auto-enrolls qualified prospects
});
```

### Pattern 3: Reply Handling Workflow

```javascript
// When prospect replies to email...

// 1. EmailOrchestrator auto-pauses campaign prospect

// 2. Move to "in_conversation" in LeadTracker
await update_prospect_status({
  prospect_id: "...",
  status: "in_conversation"
});

// 3. Create activity note
await log_activity({
  prospect_id: "...",
  type: "email_reply",
  note: "Prospect replied to Email 2 of Q4 Campaign"
});

// 4. Manual follow-up via send_email tool
```

## Reporting & Analytics

### Campaign Performance Report

```
"Generate a campaign performance report:

1. Get stats from email-orchestrator for all active campaigns
2. For each campaign, show:
   - Total prospects
   - Emails sent
   - Open rate, click rate, reply rate
   - Top performing emails
3. Compare to industry benchmarks:
   - B2B avg open rate: 21%
   - B2B avg click rate: 2.6%
   - B2B avg reply rate: 1-2%"
```

### Prospect Engagement Score

```
"For each prospect, calculate engagement score:
- Email opens: +1 point each
- Email clicks: +3 points each
- Replied: +10 points
- Downloaded resource: +5 points

Show top 20 most engaged prospects for follow-up"
```

### Pipeline Conversion Analysis

```
"Analyze conversion rates:

1. ProspectFinder: Total prospects scraped
2. LeadTracker: Prospects in each pipeline stage
3. EmailOrchestrator: Email engagement by stage
4. Calculate:
   - New → Qualified conversion
   - Qualified → In Conversation conversion (email campaign attribution)
   - In Conversation → Closed Won conversion"
```

## Best Practices

### 1. Timing

- **B2B best send times**: Tuesday-Thursday, 9-11 AM or 2-4 PM
- **Avoid**: Monday mornings, Friday afternoons, weekends
- **Spacing**: 3-7 days between emails in sequence

### 2. Personalization

- **Essential**: {{first_name}}, {{company}}
- **Strong**: {{job_title}}, {{industry}}
- **Powerful**: Recent company news, specific pain points

### 3. Subject Lines

- Keep under 50 characters
- Avoid spam triggers (FREE, URGENT, etc.)
- Test variants with A/B testing
- Personalize when possible

### 4. Email Length

- Initial email: 50-125 words
- Follow-ups: Even shorter (30-75 words)
- Clear single call-to-action

### 5. Campaign Limits

- Don't send more than 3-5 emails per campaign
- Respect unsubscribes immediately
- Monitor bounce rates (pause if > 5%)

### 6. Monitoring

- Check campaign stats daily
- Pause underperforming campaigns (< 10% open rate)
- Iterate on messaging based on data
- A/B test subject lines and CTAs

## Troubleshooting Workflows

### Low Open Rates

```
1. Check subject lines (use A/B testing)
2. Verify sender email reputation
3. Check spam score of email content
4. Test different send times
5. Warm up new sender domain
```

### Low Reply Rates

```
1. Review email copy (too salesy?)
2. Check CTA clarity
3. Improve personalization
4. Segment audience better
5. Test different value propositions
```

### High Unsubscribe Rates

```
1. Review targeting (right audience?)
2. Check email frequency
3. Improve relevance of messaging
4. Honor unsubscribes immediately
5. Add clear value in every email
```

Happy automating! 🚀
