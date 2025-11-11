# Standalone Lead Generation Tools

> Reminder: move into the `prospect-finder/` directory before running these commands.

## Quick Start - Mike's At Work Edition

You DON'T need:

- ❌ Neon database
- ❌ Claude Desktop MCP
- ❌ Complex setup

You DO need:

- ✅ Yellow Pages scraper (already working!)
- ✅ These standalone tools (you have them!)
- ✅ Excel or Google Sheets

**Result:** Start calling prospects in 5 minutes!

---

## The 6 Tools

### 1. CSV Export (PRIORITY 1 - START HERE!)

**What it does:** Converts JSON scraper results to Excel-ready CSV files

**Usage:**

```bash
npm run export:csv test-results/yellow-pages-hvac-2025-10-17T18-01-03-522Z.json
```

**Output:**

- Creates `.csv` file in same folder as JSON
- Ready to open in Excel/Google Sheets
- Includes "Notes" column for call tracking

**Example:**

```
✅ CSV exported successfully!
📁 Saved to: test-results/yellow-pages-hvac-2025-10-17T18-01-03-522Z.csv
📊 Total prospects: 30

💡 Open in Excel or Google Sheets to start calling!
```

**CSV Columns:**

- Company Name
- Phone
- Additional Phones
- Address, City, State, ZIP
- Website
- Category
- Years in Business
- Services
- BBB Rating
- Yellow Pages URL
- Notes (for your call notes!)

---

### 2. Bulk Scraper (PRIORITY 2)

**What it does:** Scrapes multiple industries × locations in one command

**Usage:**

```bash
npm run bulk:scrape
```

**Default Configuration:**

- Industries: HVAC, Plumbing, Electrical, Roofing, General Contractor
- Locations: Dallas TX, Houston TX, Phoenix AZ, Miami FL, Atlanta GA
- 20 results per search
- Estimated total: 500 prospects

**Customize:** Edit `scripts/bulk-scrape.ts` to change:

```typescript
const config: BulkSearchConfig = {
  industries: [
    "hvac",
    "plumbing",
    // Add your industries
  ],
  locations: [
    "Dallas, TX",
    "Houston, TX",
    // Add your cities
  ],
  max_results_per_search: 20,
};
```

**Output:**

```
================================================================================
BULK SCRAPE COMPLETE
================================================================================
Total searches: 25
Successful: 25
Total prospects: 487
Saved to: test-results/bulk-scrape-2025-10-17T19-30-00-000Z.json

💡 Run: npm run export:csv test-results/bulk-scrape-2025-10-17T19-30-00-000Z.json
```

---

### 3. Deduplication Tool (PRIORITY 3)

**What it does:** Removes duplicate businesses from your results

**Usage:**

```bash
npm run dedupe test-results/bulk-scrape-2025-10-17T19-30-00-000Z.json
```

**Deduplication Logic:**

- Exact phone number match
- Name + city match (normalized)

**Example:**

```
Original count: 487
After deduplication: 412
Removed: 75 duplicates
Saved to: test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json
```

---

### 4. Prioritized Call List Generator (PRIORITY 4)

**What it does:** Scores prospects and creates priority calling order

**Usage:**

```bash
npm run call-list test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json
```

**Scoring System:**

- +10 points: Has phone number (required)
- +5 points: Has website
- +8 points: 10+ years in business
- +5 points: 5-10 years in business
- +2 points: New business
- +3 points: BBB rated
- +1 point per service listed

**Output:**

```
📞 PRIORITIZED CALL LIST
Total prospects: 412

1. ABC HVAC Services (Score: 27)
   📞 (214) 555-0100
   ⭐ Has website, 15+ years established, BBB rated, 5 services listed

2. Quality Plumbing Co (Score: 24)
   📞 (713) 555-0200
   ⭐ Has website, 10+ years established, 3 services listed

[Top 20 shown in terminal]

Full call list saved to: test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped-call-list.json
```

---

### 5. Quick Search Presets (PRIORITY 5)

**What it does:** One-command searches for common scenarios

**Usage:**

```bash
npm run quick-search hvac-texas
```

**Available Presets:**

1. **hvac-texas**
   - Industry: HVAC
   - Locations: Dallas TX, Houston TX, Austin TX
   - 30 results per city

2. **plumbing-fl**
   - Industry: Plumbing
   - Locations: Miami FL, Tampa FL, Orlando FL
   - 30 results per city

3. **electrical-az**
   - Industry: Electrical Contractor
   - Locations: Phoenix AZ, Tucson AZ
   - 30 results per city

4. **roofing-ca**
   - Industry: Roofing Contractor
   - Locations: Los Angeles CA, San Diego CA
   - 30 results per city

**Example:**

```bash
npm run quick-search plumbing-fl

# Searches:
# - Plumbing in Miami, FL (30 results)
# - Plumbing in Tampa, FL (30 results)
# - Plumbing in Orlando, FL (30 results)
# Total: ~90 prospects
```

---

### 6. Statistics Reporter (PRIORITY 6)

**What it does:** Analyzes data quality and shows insights

**Usage:**

```bash
npm run stats test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json
```

**Output:**

```
📊 PROSPECT STATISTICS

Total Prospects: 412

Data Completeness:
  Phone: 412 (100.0%)
  Website: 310 (75.2%)
  Address: 405 (98.3%)
  Years in Business: 287 (69.7%)

Top Categories:
  Heating & Air Conditioning: 145
  Plumbers: 98
  Electricians: 76
  Roofing Contractors: 54
  General Contractors: 39

Top Locations:
  Dallas, TX: 87
  Houston, TX: 82
  Phoenix, AZ: 71
  Miami, FL: 89
  Atlanta, GA: 83
```

---

## Common Workflows

### Workflow 1: Quick Single Search

**Goal:** Get calling list for one industry/location ASAP

```bash
# 1. Scrape
npm run test:yellow-pages "hvac" "Dallas, TX" 30

# 2. Convert to CSV
npm run export:csv test-results/yellow-pages-hvac-2025-10-17T19-45-00-000Z.json

# 3. Open CSV in Excel and start calling!
```

**Time:** 2 minutes
**Result:** 30 prospects ready to call

---

### Workflow 2: Full Lead Generation Pipeline

**Goal:** Maximum leads with quality prioritization

```bash
# 1. Bulk scrape multiple industries/locations
npm run bulk:scrape

# 2. Remove duplicates
npm run dedupe test-results/bulk-scrape-2025-10-17T19-30-00-000Z.json

# 3. Generate prioritized call list
npm run call-list test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json

# 4. Convert to CSV
npm run export:csv test-results/bulk-scrape-2025-10-17T19-30-00-000Z-deduped-call-list.json

# 5. Open CSV in Excel - prospects are sorted by priority!
```

**Time:** 30-60 minutes (mostly automated)
**Result:** 400+ unique prospects, prioritized and ready to call

---

### Workflow 3: Quick Preset Search

**Goal:** Fast search for common scenarios

```bash
# 1. Use preset
npm run quick-search hvac-texas

# 2. Find the latest bulk file in test-results/
# 3. Convert to CSV
npm run export:csv test-results/yellow-pages-hvac-2025-10-17T20-00-00-000Z.json

# 4. Start calling!
```

**Time:** 5 minutes
**Result:** 90 prospects from 3 cities

---

### Workflow 4: Quality Analysis First

**Goal:** Understand your data before calling

```bash
# 1. Scrape
npm run test:yellow-pages "plumbing" "Miami, FL" 50

# 2. Check quality
npm run stats test-results/yellow-pages-plumbing-2025-10-17T20-15-00-000Z.json

# 3. If quality is good (>95% phone coverage), export
npm run export:csv test-results/yellow-pages-plumbing-2025-10-17T20-15-00-000Z.json
```

**Time:** 3 minutes
**Result:** Know your data quality BEFORE wasting time on bad leads

---

## Tips for Bulk Scraping

### Start Small

```bash
# First run: 5 searches
# Edit bulk-scrape.ts to use just 1-2 industries × 2-3 cities
# Verify results before going bigger
```

### Respectful Scraping

```bash
# Built-in delays:
# - 5 seconds between searches
# - Rate limiting per scraper config
# - Browser pool limits concurrent requests

# Don't modify these - they keep you unblocked!
```

### Best Times to Scrape

```bash
# Evening/weekend: Less competition for Yellow Pages servers
# Weekday mornings: Get fresh leads for same-day calling
```

### Error Recovery

```bash
# If a scrape fails mid-way:
# - Check test-results/ for partial results
# - The tool saves what it found before failing
# - Just re-run to continue
```

---

## Organizing Your Results

### Folder Structure

```
test-results/
├── yellow-pages-hvac-2025-10-17T18-01-03-522Z.json      # Single search
├── yellow-pages-hvac-2025-10-17T18-01-03-522Z.csv       # Excel ready
├── bulk-scrape-2025-10-17T19-30-00-000Z.json            # Bulk results
├── bulk-scrape-2025-10-17T19-30-00-000Z-deduped.json    # Deduplicated
├── bulk-scrape-...-deduped-call-list.json               # Prioritized
└── bulk-scrape-...-deduped-call-list.csv                # Final calling list
```

### File Naming Convention

- **yellow-pages-{industry}-{timestamp}.json** - Single scrape results
- **bulk-scrape-{timestamp}.json** - Bulk scrape results
- **{filename}-deduped.json** - After removing duplicates
- **{filename}-call-list.json** - After priority scoring
- **{filename}.csv** - CSV export (open in Excel)

### Archiving

```bash
# After you've called all prospects, archive the files:
mkdir test-results/archive-2025-10-17/
mv test-results/bulk-scrape-* test-results/archive-2025-10-17/
```

---

## Excel/Google Sheets Tips

### After Opening CSV

1. **Freeze Header Row**
   - View > Freeze > 1 Row
   - Now headers stay visible while scrolling

2. **Auto-fit Columns**
   - Select all columns
   - Double-click column border to auto-resize

3. **Add Call Status Column**
   - Column O: "Call Status"
   - Values: Not Called, Voicemail, Talked, Not Interested, Callback

4. **Add Date Called Column**
   - Column P: "Date Called"

5. **Color Code Rows**
   - Green: Interested/Callback
   - Yellow: Voicemail
   - Red: Not Interested
   - Gray: Not Called

6. **Use Filters**
   - Data > Filter
   - Filter by City, Category, Years in Business, etc.

### Sample Call Tracking

| Call Status    | Date Called | Notes                                |
| -------------- | ----------- | ------------------------------------ |
| Talked         | 10/17/2025  | Interested in quote, callback Friday |
| Voicemail      | 10/17/2025  | Left message                         |
| Not Interested | 10/17/2025  | Already has provider                 |

---

## Troubleshooting

### "File not found" Error

```bash
# Make sure you're using the correct path
# Use tab completion or copy/paste the filename
npm run export:csv test-results/[TAB to autocomplete]
```

### "No results found" in Scrape

```bash
# Try broader search terms:
# ✅ "hvac" instead of "hvac repair"
# ✅ "plumbing" instead of "emergency plumber"
# ✅ "Dallas, TX" instead of "75001"
```

### CSV Opens with Garbage Characters

```bash
# Open Excel > Data > Import From Text
# Choose UTF-8 encoding
# Or use Google Sheets (handles UTF-8 automatically)
```

### Bulk Scrape Takes Too Long

```bash
# Edit scripts/bulk-scrape.ts
# Reduce max_results_per_search from 20 to 10
# Or reduce number of industries/locations
```

---

## Next Steps (When You're Home)

1. **Set up Neon Database**
   - Follow DATABASE_SETUP.md
   - Store all prospects permanently
   - Track call history across sessions

2. **Configure Claude Desktop MCP**
   - Follow MCP_INTEGRATION.md
   - Query database with natural language
   - "Show me all HVAC companies in Dallas I haven't called yet"

3. **Advanced Features**
   - Email finding (Hunter.io integration)
   - LinkedIn enrichment
   - Website scraping for tech stack analysis

But for now? **You have everything you need to start calling prospects RIGHT NOW!**

---

## Quick Reference

| Task              | Command                                            |
| ----------------- | -------------------------------------------------- |
| Single search     | `npm run test:yellow-pages "hvac" "Dallas, TX" 30` |
| Bulk search       | `npm run bulk:scrape`                              |
| Preset search     | `npm run quick-search hvac-texas`                  |
| Export to CSV     | `npm run export:csv <json-file>`                   |
| Remove duplicates | `npm run dedupe <json-file>`                       |
| Prioritize leads  | `npm run call-list <json-file>`                    |
| View statistics   | `npm run stats <json-file>`                        |

---

## Mike's 5-Minute Quick Start

```bash
# 1. Run a quick search
npm run quick-search hvac-texas

# 2. Wait for it to complete (finds latest JSON file)
# Look for output like: "Saved to: test-results/yellow-pages-..."

# 3. Export to CSV (replace with your actual filename)
npm run export:csv test-results/yellow-pages-hvac-2025-10-17T20-00-00-000Z.json

# 4. Open the CSV file in Excel

# 5. Start calling! 📞
```

**You now have 90 HVAC companies in Texas with phone numbers!**

---

## Support

Questions? Check:

- README.md - Overall project documentation
- YELLOW_PAGES_GUIDE.md - Yellow Pages scraper details
- test-results/ folder - Your scraped data

**Happy prospecting!** 🚀
