# Lead Generation Quick Start Cheat Sheet

> Run these commands inside `prospect-finder/` (e.g., `cd prospect-finder` first).

## Mike's 3-Step Workflow (Start to Finish)

### FASTEST PATH (5 minutes)

```bash
# 1. Quick search with preset
npm run quick-search hvac-texas

# 2. Export newest JSON to CSV (use your actual filename)
npm run export:csv test-results/yellow-pages-hvac-[TAB to autocomplete]

# 3. Open CSV in Excel - START CALLING!
```

---

## All Available Commands

| Command                     | What It Does                   | Example                                            |
| --------------------------- | ------------------------------ | -------------------------------------------------- |
| `npm run test:yellow-pages` | Single search                  | `npm run test:yellow-pages "hvac" "Dallas, TX" 30` |
| `npm run export:csv`        | Convert JSON to Excel CSV      | `npm run export:csv test-results/file.json`        |
| `npm run bulk:scrape`       | Scrape 5 industries × 5 cities | `npm run bulk:scrape`                              |
| `npm run quick-search`      | Preset searches                | `npm run quick-search hvac-texas`                  |
| `npm run dedupe`            | Remove duplicates              | `npm run dedupe test-results/file.json`            |
| `npm run call-list`         | Prioritize prospects           | `npm run call-list test-results/file.json`         |
| `npm run stats`             | View statistics                | `npm run stats test-results/file.json`             |

---

## Quick Search Presets

| Preset          | Industries | Cities                  | Total Leads |
| --------------- | ---------- | ----------------------- | ----------- |
| `hvac-texas`    | HVAC       | Dallas, Houston, Austin | ~90         |
| `plumbing-fl`   | Plumbing   | Miami, Tampa, Orlando   | ~90         |
| `electrical-az` | Electrical | Phoenix, Tucson         | ~60         |
| `roofing-ca`    | Roofing    | LA, San Diego           | ~60         |

**Usage:** `npm run quick-search hvac-texas`

---

## The 3 Main Workflows

### 1. SINGLE SEARCH (Fastest)

```bash
npm run test:yellow-pages "hvac" "Dallas, TX" 30
npm run export:csv test-results/yellow-pages-hvac-[TIMESTAMP].json
# Open CSV in Excel
```

**Time:** 2 minutes | **Result:** 30 prospects

---

### 2. PRESET SEARCH (Easy)

```bash
npm run quick-search hvac-texas
npm run export:csv test-results/yellow-pages-hvac-[TIMESTAMP].json
# Open CSV in Excel
```

**Time:** 5 minutes | **Result:** 90 prospects

---

### 3. BULK SEARCH (Maximum Leads)

```bash
npm run bulk:scrape
npm run dedupe test-results/bulk-scrape-[TIMESTAMP].json
npm run call-list test-results/bulk-scrape-[TIMESTAMP]-deduped.json
npm run export:csv test-results/bulk-scrape-[TIMESTAMP]-deduped-call-list.json
# Open CSV in Excel - sorted by priority!
```

**Time:** 30-60 minutes | **Result:** 400+ prioritized prospects

---

## File Pipeline

```
1. Scrape          → yellow-pages-hvac-2025-10-17T18-01-03-522Z.json
2. Dedupe          → yellow-pages-hvac-2025-10-17T18-01-03-522Z-deduped.json
3. Prioritize      → yellow-pages-hvac-2025-10-17T18-01-03-522Z-deduped-call-list.json
4. Export to CSV   → yellow-pages-hvac-2025-10-17T18-01-03-522Z-deduped-call-list.csv
5. Open in Excel   → START CALLING! 📞
```

---

## Excel Quick Setup

After opening CSV:

1. **Freeze header row:** View → Freeze → 1 Row
2. **Auto-fit columns:** Select all → Double-click column border
3. **Add these columns:**
   - Column O: "Call Status" (Not Called, Voicemail, Talked, Not Interested, Callback)
   - Column P: "Date Called"
   - Column Q: "Follow-up Date"

4. **Enable filters:** Data → Filter
5. **Color code:**
   - Green = Interested/Callback
   - Yellow = Voicemail
   - Red = Not Interested

---

## Priority Scoring System

Your call list is automatically scored:

| Factor                | Points  | Why It Matters        |
| --------------------- | ------- | --------------------- |
| Has phone             | +10     | Required to call      |
| Has website           | +5      | Shows professionalism |
| 10+ years in business | +8      | Established, stable   |
| 5-10 years            | +5      | Mid-stage growth      |
| BBB rated             | +3      | Quality indicator     |
| Services listed       | +1 each | Detail-oriented       |

**High scores (25+) = Call these FIRST!**

---

## Troubleshooting

### Can't find JSON file?

```bash
# List all results
ls test-results/

# Or use tab completion
npm run export:csv test-results/[TAB]
```

### No results from scrape?

- Use broader terms: "hvac" not "hvac repair"
- Use city format: "Dallas, TX" not "75001"
- Try different location if one fails

### CSV looks weird in Excel?

- Use Google Sheets (better UTF-8 support)
- Or: Excel → Data → Import From Text → Choose UTF-8

---

## Today's Goal

**Minimum:** 30 prospects in 5 minutes
**Realistic:** 90 prospects in 15 minutes
**Ambitious:** 400+ prospects in 1 hour

**All with 100% phone coverage!** ✅

---

## Print This Page!

Cut along the dotted line and tape to your monitor:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MIKE'S QUICK REFERENCE CARD

Quick Search:
  npm run quick-search hvac-texas

Export to CSV:
  npm run export:csv test-results/[FILENAME].json

View Stats:
  npm run stats test-results/[FILENAME].json

Preset Options:
  - hvac-texas
  - plumbing-fl
  - electrical-az
  - roofing-ca

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**NOW GO MAKE SOME CALLS!** 📞💰
