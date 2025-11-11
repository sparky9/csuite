# Claude Mobile Voice Flows

Design reference for making VPA Core feel native on Claude Mobile (voice-first) while keeping parity with Claude Desktop and Claude Code.

## Voice Design Principles

- **One breath prompts** – Assume the user is driving or between meetings; every critical workflow should succeed with 5-10 spoken words.
- **Structured confirmations** – Tools answer with a tight summary plus one suggested follow-up (“Need anything else for Acme?”) so the user can immediately chain commands.
- **Stateful quick actions** – Maintain a short-lived context buffer (last prospect, last activity, last list) for 2 minutes or until explicitly changed.
- **Graceful fallbacks** – When intent is ambiguous, ask quickly (“Did you want pipeline stats or follow-ups?”) and reuse the same tool once clarified.
- **Hands-free resilience** – Responses use natural speech, avoid JSON dumps, and read out dates/times clearly (“Friday at 2 PM central”).

## Context Buffer Requirements

| Buffer Key     | Payload                                         | TTL                                         | Used By                     |
| -------------- | ----------------------------------------------- | ------------------------------------------- | --------------------------- |
| `lastProspect` | `{ prospectId, name, status, lastInteraction }` | 2 minutes or next explicit prospect mention | Quick log + follow-up flows |
| `lastActivity` | `{ activityId, prospectId, type, notes }`       | 2 minutes                                   | Follow-up confirmation      |
| `lastSearch`   | `{ querySummary, prospectIds }`                 | 5 minutes                                   | Import / drill-down flows   |

Persist these in `voiceContextCache` (module within orchestrator). Clear on session end or when user says “forget that”.

## Core Voice Flows

### 1. Morning Briefing

- **Typical prompts:**
  - “Give me my morning rundown.”
  - “What’s on deck today?”
- **Intent routing:** `vpa_status` with `report_type: "daily_brief"` (new action aggregating follow-ups, pipeline deltas, campaign alerts).
- **Sample response:**
  - “You have three follow-ups today: Acme at 10 AM, Metro HVAC at 1 PM, and Lone Star Plumbing overdue by one day. Pipeline shifted: One deal moved to negotiating, one new qualified lead. Want to review any of those?”
- **Follow-ups:** If user replies “Call the overdue one,” set `lastProspect` to Lone Star Plumbing and route to Activity flow.

### 2. Quick Activity Log

- **Prompt variants:**
  - “Log a call with Acme—left voicemail asking for Friday.”
  - “Make a note we emailed Metro HVAC about pricing.”
- **Intent routing:** `vpa_pipeline` with `action: "log_activity"`.
  - Extract `prospect`, `activity_type`, `outcome`, `notes`, optional `follow_up`. If prospect omitted, rely on `lastProspect` or ask once.
- **Response format:**
  - “Logged a call for Acme Heating: outcome voicemail; follow-up set for Friday at 2 PM. Need to add anything else?”
- **Context updates:** Set both `lastProspect` and `lastActivity` for quick follow-up adjustments.

### 3. Follow-Up Scheduling

- **Prompt variants:**
  - “Push that follow-up to Monday at nine.”
  - “Remind me tomorrow morning instead.”
- **Intent routing:** `vpa_pipeline` with `action: "update_follow_up"` (new micro-action) referencing `lastActivity` or `lastProspect`.
- **Response:**
  - “Follow-up for Acme moved to Monday 9:00 AM Central. Want a reminder summary?”
- **Fallback:** If no cached activity, prompt: “Which prospect should I reschedule?”

### 4. Prospect Quick Search

- **Prompt variants:**
  - “Find five HVAC companies near Austin.”
  - “Any electrical contractors in Phoenix worth calling?”
- **Intent routing:** `vpa_prospects` with `action: "search"`, auto-limit to 5 for voice unless user specifies.
- **Response:**
  - “Found five HVAC companies in Austin. Top pick: Lone Star Cooling, 4.8 stars, owner Maria Lopez. Want to import them or hear another?”
- **Context:** Populate `lastSearch` with summary and IDs for instant import (“Yes import them” → `vpa_pipeline` `action: "import"`).

### 5. Rapid Campaign Kickoff

- **Prompt variants:**
  - “Start a follow-up email sequence for those Austin leads.”
  - “Send a quick nurture email to everyone we just imported.”
- **Intent routing:**
  - Use `lastSearch` or explicit cohort; call `vpa_email` `action: "create_and_start_sequence"` (wrapper that bundles campaign creation + start).
- **Response:**
  - “Drafted the 3-step follow-up campaign ‘Austin HVAC touchpoint’ and started it for five leads. First email goes out in 10 minutes. Want the talking points?”
- **Optional:** Offer to copy talking points back to the user for voice rehearsal.

### 6. Voice-Friendly Analytics

- **Prompt variants:**
  - “How’s my pipeline looking this week?”
  - “What’s my win rate last month?”
- **Intent routing:** `vpa_pipeline` `action: "stats"` with timeframe + grouping defaults (week/status).
- **Response:**
  - “This week: 12 active prospects, 3 in negotiation, win rate 28%. Want a deeper breakdown?”
- **Enhancement:** Provide quick send-to-email option for full report.

### 7. Module Discovery Tabs

- **Prompt variants:**
  - “What modules do I have?”
  - “Show me the email tools.”
- **Intent routing:** `vpa_modules` `action: "list"` leveraging the module catalog metadata.
- **Response:**
  - “LeadTracker Pro is enabled with follow-up quick actions. ProspectFinder and EmailOrchestrator are locked on your current plan. Say ‘Find 25 roofers in Phoenix’ to try ProspectFinder when you upgrade.”
- **Follow-ups:** Surface voice-ready quick actions (e.g., “Say ‘Give me my daily brief’”) so users jump directly into the next task.

## Error & Clarification Patterns

- **Ambiguity**: “I heard two company names—Acme or Metro?” Wait for confirmation, then proceed.
- **Unavailable context**: “I don’t have a recent prospect to reference. Who should we update?”
- **Retry strategy**: If tool throws (e.g., DB offline), voice reply: “Couldn’t reach the database just now. Try again or check your connection.”

## Implementation Checklist

1. **Context Cache Module** – Add lightweight in-memory cache to orchestrator with TTL enforcement.
2. **Voice Response Templates** – Centralize `formatVoiceResponse()` utilities in each module to keep tone consistent.
3. **New Micro-Actions** – Implement `daily_brief`, `update_follow_up`, and `create_and_start_sequence` wrappers.
4. **Prompt Examples** – Update module READMEs and training data with voice-first phrases to prime Claude.
5. **QA** – Simulate flows using Claude Mobile transcripts and refine confirmation prompts.
6. **Module Catalog Voice Hooks** – Ensure `vpa_modules` voices quick actions + upgrade hints with the new registry metadata.

With these flows implemented, solopreneurs get a conversational assistant that truly handles their day while they stay heads-up.
