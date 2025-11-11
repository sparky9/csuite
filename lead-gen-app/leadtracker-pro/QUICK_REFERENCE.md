# LeadTracker Pro - Quick Reference

## 🚀 Setup Commands

```bash
# Install dependencies
npm install

# Set up database
npm run db:setup

# Build TypeScript
npm run build

# Run in dev mode
npm run dev
```

## 📋 MCP Tools Quick Reference

### 1. add_prospect
Create new prospect
```
Add prospect: Company Name
Phone: (555) 123-4567
Email: contact@company.com
City: Dallas, State: TX
Tags: HVAC, High Priority
Deal Value: $15,000
```

### 2. add_contact
Add decision maker
```
Add contact to [prospect-id]:
Name: John Smith
Title: Owner
Phone: (555) 123-4567
Primary: yes
```

### 3. update_prospect_status
Move through pipeline
```
Update [prospect-id] to "contacted"
Notes: Left voicemail, will call back tomorrow
```

**Statuses:** new, contacted, qualified, meeting_scheduled, proposal_sent, negotiating, closed_won, closed_lost, on_hold

### 4. log_activity
Track interactions
```
Log call for [prospect-id]:
- Outcome: answered
- Duration: 180 seconds
- Notes: Discussed HVAC needs
- Follow-up: 2024-10-22T10:00:00Z
```

**Types:** call, email, meeting, note
**Outcomes:** answered, voicemail, no_answer, wrong_number

### 5. search_prospects
Find and filter
```
Search prospects:
- Status: qualified
- City: Dallas
- Tags: HVAC
- Limit: 20
```

### 6. get_follow_ups
View reminders
```
Show overdue follow-ups
What's due today?
Get this week's follow-ups
```

**Ranges:** today, this_week, next_week, overdue, all

### 7. get_pipeline_stats
Analytics
```
Pipeline stats for this month
Revenue breakdown by source
```

**Group By:** status, source, city, tags

### 8. import_prospects
ProspectFinder import
```
Import from D:\exports\file.json
- Status: new
- Tags: HVAC, Dallas
- Source: Yellow Pages Oct 2024
```

## 🎯 Common Workflows

### Morning Routine
```
Show overdue follow-ups
What's due today?
Pipeline stats this week
```

### After Calling
```
Log call for [id]:
- Outcome: voicemail
- Notes: Left callback request
- Follow-up: tomorrow 2pm
```

### Import Batch
```
Import prospects from [file]
Tags: [batch-tags]
Source: [description]
```

### Pipeline Review
```
Search status "qualified"
Pipeline stats by status
Show high-value prospects
```

## 🗄️ Database Tables

- **prospects** - Company info, status, deals
- **contacts** - Decision makers
- **activities** - Call/email/meeting log
- **follow_ups** - Reminders
- **leadtracker_config** - System settings

## 🔧 Troubleshooting

**Tools not showing:**
1. Check claude_desktop_config.json path
2. Run `npm run build`
3. Restart Claude Desktop

**Database error:**
1. Check .env DATABASE_URL
2. Run `npm run db:setup`
3. Verify Neon connection

**Import failing:**
1. Check file path (absolute)
2. Verify JSON format
3. Check logs for errors

## 📊 Status Emojis

- 🆕 new
- 📞 contacted
- ✅ qualified
- 📅 meeting_scheduled
- 📄 proposal_sent
- 🤝 negotiating
- 🎉 closed_won
- ❌ closed_lost
- ⏸️ on_hold

## 💾 Data Retention

- **3 months** - Short-term
- **6 months** - Standard
- **12 months** - Default
- **24 months** - Important
- **60 months** - Long-term

## 🔗 File Locations

**Config:** `claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\`
- macOS: `~/Library/Application Support/Claude/`

**Environment:** `.env` (in project root)

**Schema:** `src/db/schema.sql`

**Setup Script:** `scripts/setup-leadtracker.ts`

## 📞 Example Conversations

**Add prospect from call:**
```
I just called Dallas HVAC Solutions at (214) 555-1234.
Add them as a prospect. City: Dallas, State: TX, Tags: HVAC
Deal value $15,000. Notes: Interested in 5-year warranty
```

**Log call and schedule follow-up:**
```
Log call for [prospect-id]. I spoke with the owner for 5 minutes.
Outcome was answered. He wants a proposal by Friday.
Set follow-up for October 20th at 10am.
```

**Morning check-in:**
```
Good morning! Show me what I need to do today:
1. Any overdue follow-ups?
2. What's due today?
3. How's my pipeline looking this week?
```

**Import Yellow Pages results:**
```
I scraped 50 HVAC companies in Dallas yesterday.
Import them from D:\exports\dallas-hvac-oct17.json
Tag them: HVAC, Dallas, Q4-2024
Source: Yellow Pages Dallas HVAC October 2024
```

---

**Quick Start:** See SETUP_GUIDE.md
**Full Docs:** See README.md
**Build Info:** See BUILD_COMPLETE.md
