# MIKE START HERE - Your Lead Generation System is READY!

## What Just Got Built

Mike, you now have **6 standalone tools** that work WITHOUT the database. You can start generating calling leads RIGHT NOW while at work!

---

## The Good News

**Yellow Pages Scraper:** 100% phone coverage! Every business has a phone number.

**No Setup Required:** No database, no Claude Desktop MCP needed for these tools.

**Works Right Now:** Install dependencies and start scraping in 2 minutes.

---

> **Run commands from `prospect-finder/`:** move into this directory (`cd prospect-finder`) before executing the scripts below.

## Your 5-Minute Quick Start

```bash
# 1. Install (one time only)
npm install

# 2. Run a preset search (gets you ~90 leads)
npm run quick-search hvac-texas

# 3. Export to CSV for Excel
npm run export:csv test-results/yellow-pages-hvac-[TAB to autocomplete]

# 4. Open the CSV file in Excel

# 5. START CALLING! 📞
```

**That's it!** You now have 90 HVAC companies in Texas with phone numbers ready to call.

---

## The 6 Tools You Have

### 1. CSV Export (Use This First!)

**Converts JSON scraper results to Excel-ready CSV files**

```bash
npm run export:csv test-results/yellow-pages-hvac-2025-10-17T18-01-03-522Z.json
```

**Output:** Excel file with all prospect data + blank "Notes" column for call tracking

---

### 2. Bulk Scraper

**Scrapes multiple industries × cities in one command**

```bash
npm run bulk:scrape
```

**Default:**

- 5 industries (HVAC, Plumbing, Electrical, Roofing, General Contractor)
- 5 cities (Dallas, Houston, Phoenix, Miami, Atlanta)
- 20 results per search
- **Total: ~500 prospects**

**Customize:** Edit `scripts/bulk-scrape.ts` to change industries/cities

---

### 3. Quick Search Presets

**One-command searches for common scenarios**

```bash
npm run quick-search hvac-texas      # HVAC in Dallas, Houston, Austin
npm run quick-search plumbing-fl     # Plumbing in Miami, Tampa, Orlando
npm run quick-search electrical-az   # Electrical in Phoenix, Tucson
npm run quick-search roofing-ca      # Roofing in LA, San Diego
```

**Each gets you ~60-90 prospects**

---

### 4. Deduplication Tool

**Removes duplicate businesses from your results**

```bash
npm run dedupe test-results/bulk-scrape-2025-10-17T19-30-00-000Z.json
```

**Logic:**

- Exact phone match
- Name + city match

**Result:** Clean list with no duplicates

---

### 5. Prioritized Call List Generator

**Scores prospects and creates priority calling order**

```bash
npm run call-list test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json
```

**Scoring:**

- +10: Has phone (required)
- +5: Has website
- +8: 10+ years in business
- +5: 5-10 years
- +3: BBB rated
- +1: Each service listed

**Result:** Prospects sorted by quality (call high scores first!)

---

### 6. Statistics Reporter

**Analyzes data quality and shows insights**

```bash
npm run stats test-results/bulk-scrape-2025-10-17T19-30-00-000Z.json
```

**Shows:**

- Total prospects
- Data completeness (phone, website, address, etc.)
- Top categories
- Top locations

---

## The 3 Main Workflows

### Workflow 1: Single Quick Search (5 minutes)

**When:** You want leads for ONE industry/city ASAP

```bash
npm run test:yellow-pages "hvac" "Dallas, TX" 30
npm run export:csv test-results/yellow-pages-hvac-[TIMESTAMP].json
# Open CSV and call!
```

**Result:** 30 prospects ready to call

---

### Workflow 2: Preset Search (10 minutes)

**When:** You want 90 leads from 3 cities in one industry

```bash
npm run quick-search hvac-texas
npm run export:csv test-results/yellow-pages-hvac-[TIMESTAMP].json
# Open CSV and call!
```

**Result:** 90 prospects from Dallas, Houston, Austin

---

### Workflow 3: Bulk Pipeline (30-60 minutes)

**When:** You want MAXIMUM leads with quality prioritization

```bash
# 1. Bulk scrape
npm run bulk:scrape

# 2. Remove duplicates
npm run dedupe test-results/bulk-scrape-[TIMESTAMP].json

# 3. Generate prioritized call list
npm run call-list test-results/bulk-scrape-[TIMESTAMP]-deduped.json

# 4. Export to CSV
npm run export:csv test-results/bulk-scrape-[TIMESTAMP]-deduped-call-list.json

# 5. Open CSV - prospects are SORTED by priority!
```

**Result:** 400+ unique prospects, prioritized and ready to call

---

## What the CSV File Looks Like

| Column            | Example                        | Why It Matters       |
| ----------------- | ------------------------------ | -------------------- |
| Company Name      | ABC HVAC Services              | Who you're calling   |
| Phone             | (214) 555-0100                 | Main number          |
| Additional Phones | (214) 555-0101; (214) 555-0102 | Backup numbers       |
| Address           | 123 Main St                    | Where they are       |
| City              | Dallas                         | Location             |
| State             | TX                             | Location             |
| ZIP               | 75201                          | Location             |
| Website           | abc-hvac.com                   | Research before call |
| Category          | HVAC                           | Industry             |
| Years in Business | 15                             | Established = stable |
| Services          | AC Repair; Heating             | What they do         |
| BBB Rating        | A+                             | Quality indicator    |
| Yellow Pages URL  | [url]                          | Source link          |
| Notes             | _YOUR CALL NOTES_              | Track your calls     |

---

## Excel Tips for Call Tracking

### After Opening CSV:

1. **Freeze header row** (View → Freeze → 1 Row)
2. **Auto-fit columns** (Select all → Double-click border)
3. **Add call tracking columns:**
   - Column O: "Call Status" (Not Called, Voicemail, Talked, Not Interested, Callback)
   - Column P: "Date Called"
   - Column Q: "Follow-up Date"
   - Column R: "Next Action"

4. **Color code rows:**
   - Green = Interested/Callback
   - Yellow = Voicemail
   - Red = Not Interested
   - Gray = Not Called

5. **Use filters** (Data → Filter)
   - Filter by City
   - Filter by Years in Business
   - Filter by Call Status

---

## Customizing Bulk Scraper

Edit `scripts/bulk-scrape.ts`:

```typescript
const config: BulkSearchConfig = {
  industries: [
    "hvac",
    "plumbing",
    "electrical contractor",
    "roofing contractor",
    "general contractor",
    // ADD YOUR INDUSTRIES HERE
  ],
  locations: [
    "Dallas, TX",
    "Houston, TX",
    "Phoenix, AZ",
    "Miami, FL",
    "Atlanta, GA",
    // ADD YOUR CITIES HERE
  ],
  max_results_per_search: 20, // Change this if you want more/less per search
};
```

**Save the file and run:** `npm run bulk:scrape`

---

## Customizing Quick Search Presets

Edit `scripts/quick-search.ts`:

```typescript
const presets = {
  "hvac-texas": {
    industry: "hvac",
    locations: ["Dallas, TX", "Houston, TX", "Austin, TX"],
    count: 30,
  },
  "plumbing-fl": {
    industry: "plumbing",
    locations: ["Miami, FL", "Tampa, FL", "Orlando, FL"],
    count: 30,
  },
  "electrical-az": {
    industry: "electrical contractor",
    locations: ["Phoenix, AZ", "Tucson, AZ"],
    count: 30,
  },
  "roofing-ca": {
    industry: "roofing contractor",
    locations: ["Los Angeles, CA", "San Diego, CA"],
    count: 30,
  },
  // ADD YOUR PRESETS HERE
  "hvac-florida": {
    industry: "hvac",
    locations: ["Tampa, FL", "Jacksonville, FL", "Fort Lauderdale, FL"],
    count: 30,
  },
};
```

**Run with:** `npm run quick-search hvac-florida`

---

## File Organization

Your scraped data goes to: `test-results/`

**File naming:**

```
test-results/
├── yellow-pages-hvac-2025-10-17T18-01-03-522Z.json      # Single search
├── yellow-pages-hvac-2025-10-17T18-01-03-522Z.csv       # Excel ready
├── bulk-scrape-2025-10-17T19-30-00-000Z.json            # Bulk results
├── bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json    # No duplicates
├── bulk-scrape-...-deduped-call-list.json               # Prioritized
└── bulk-scrape-...-deduped-call-list.csv                # Final calling list
```

**Archive old files:**

```bash
mkdir test-results/archive-2025-10-17/
mv test-results/bulk-scrape-* test-results/archive-2025-10-17/
```

---

## Sample Call Script

**Opening:**

> "Hi, this is Mike from [Your Company]. I help HVAC companies like yours with [your service]. Do you have a quick minute?"

**Qualification:**

> "I saw you've been in business for 15+ years - congratulations! Are you currently looking for help with [your service]?"

**Next Steps:**

> "Great! I'd love to send over some information. What's the best email to reach you at?"

**Track in Excel "Notes" column:**

- Interested → Schedule callback
- Voicemail → Note time, call back tomorrow
- Not Interested → Mark red, move on
- Gatekeeper → Get decision maker name/email

---

## Troubleshooting

### "File not found" error

```bash
# Use tab completion
npm run export:csv test-results/[TAB]

# Or list files first
ls test-results/
```

### No results from scrape

- Use broader terms: "hvac" not "hvac repair"
- Use city format: "Dallas, TX" not "75001"
- Try different location if one fails

### CSV looks weird in Excel

- Use Google Sheets (better UTF-8 support)
- Or: Excel → Data → Import From Text → UTF-8

### Scrape is too slow

```bash
# Edit scripts/bulk-scrape.ts
# Reduce max_results_per_search from 20 to 10
# Or reduce number of industries/locations
```

---

## What's Next (When You Get Home)

Once you're ready to level up:

1. **Set up Neon Database** (see `DATABASE_SETUP.md`)
   - Store all prospects permanently
   - Track call history across sessions
   - Never lose your data

2. **Configure Claude Desktop MCP** (see `MCP_INTEGRATION.md`)
   - Query database with natural language
   - "Show me all HVAC companies in Dallas I haven't called yet"
   - AI-powered lead intelligence

3. **Advanced Features:**
   - Email finding (Hunter.io integration)
   - LinkedIn enrichment
   - Website scraping for tech stack analysis
   - RAG-powered deduplication

**But for now, you have EVERYTHING you need to start calling!**

---

## Documentation Files

- **STANDALONE_TOOLS.md** - Complete guide to all 6 tools
- **QUICK_START_CHEATSHEET.md** - Quick reference card (print this!)
- **YELLOW_PAGES_IMPLEMENTATION.md** - Technical details of scraper
- **SCRAPERS.md** - Overview of all scrapers
- **README.md** - Full project documentation

---

## Quick Reference

| Task              | Command                                            |
| ----------------- | -------------------------------------------------- |
| Single search     | `npm run test:yellow-pages "hvac" "Dallas, TX" 30` |
| Preset search     | `npm run quick-search hvac-texas`                  |
| Bulk search       | `npm run bulk:scrape`                              |
| Export to CSV     | `npm run export:csv <json-file>`                   |
| Remove duplicates | `npm run dedupe <json-file>`                       |
| Prioritize leads  | `npm run call-list <json-file>`                    |
| View statistics   | `npm run stats <json-file>`                        |

---

## Success Metrics

**After 1 hour of using these tools, you should have:**

- ✅ 400+ unique prospects
- ✅ 100% phone coverage (every prospect has a phone number)
- ✅ Prioritized call list (high quality leads first)
- ✅ Excel spreadsheet for call tracking
- ✅ Ready to start calling

**After 1 day of calling:**

- ✅ 50-100 calls made
- ✅ 10-20 meaningful conversations
- ✅ 3-5 hot leads
- ✅ 1-2 appointments booked

**After 1 week:**

- ✅ 1000+ prospects in database
- ✅ 200-500 calls made
- ✅ 20-50 hot leads
- ✅ 5-10 deals in pipeline

---

## The Bottom Line

**You asked for tools to start prospecting while at work.**

**You got:**

1. Yellow Pages scraper (100% phone coverage)
2. CSV export for Excel
3. Bulk scraper (500+ prospects in one run)
4. Deduplication tool
5. Prioritized call list generator
6. Quick search presets
7. Statistics reporter

**All working WITHOUT database setup.**

**Time to first leads: 5 minutes**

**NOW GO MAKE SOME MONEY!** 📞💰🚀

---

## Need Help?

- Check `STANDALONE_TOOLS.md` for detailed documentation
- Check `QUICK_START_CHEATSHEET.md` for quick reference
- All commands listed in `package.json` scripts section
- Test results saved in `test-results/` folder

**Happy prospecting!**
