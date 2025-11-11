# ProspectFinder Scrapers Documentation

## Overview

ProspectFinder includes 6 production-ready scrapers for finding B2B prospects:

1. **Yellow Pages Scraper** - PRIMARY data source for B2B companies (superior data quality)
2. **Google Maps Scraper** - FALLBACK data source for businesses
3. **LinkedIn Company Scraper** - Extract company data from LinkedIn
4. **LinkedIn People Scraper** - Find decision makers at companies
5. **Email Finder** - Generate and verify email addresses
6. **Website Scraper** - Extract contact info from company websites

All scrapers include:
- Browser pool management with proxy rotation
- Rate limiting to prevent bans
- Retry logic with exponential backoff
- Anti-detection measures (stealth mode, random delays, human-like behavior)
- Comprehensive error handling and logging

---

## New Priority Order (Updated 2025-10-17)

### Why Yellow Pages is Now PRIMARY

After analysis by Mike's Claude Desktop persona, **Yellow Pages has been identified as superior to Google Maps** for B2B prospecting:

**Advantages:**
1. **More Complete Data** - Phone, address, website all in one place
2. **Business-Focused** - Designed for B2B discovery (not consumers)
3. **Cleaner Structure** - More consistent data format than Google Maps
4. **Better Categorization** - Industry categories map perfectly to blue-collar businesses
5. **Less Aggressive** - Easier to scrape than Google Maps, fewer anti-bot measures
6. **Up-to-Date** - Businesses keep Yellow Pages current for lead generation

**New Workflow:**
- `search_companies` tool tries **Yellow Pages FIRST**
- If Yellow Pages fails or returns 0 results, automatically **falls back to Google Maps**
- This ensures maximum data quality while maintaining reliability

---

## 1. Yellow Pages Scraper (PRIMARY)

### Purpose
Searches Yellow Pages for businesses by industry + location. This is the **PRIMARY data source** for finding B2B companies due to superior data completeness.

### What It Extracts
- Company name
- Phone number (primary)
- Additional phone numbers
- Full address (street, city, state, zip)
- Website URL
- Business category
- Years in business (unique to Yellow Pages!)
- Services offered
- BBB rating (if available)
- Yellow Pages URL

### Usage

```typescript
import { YellowPagesScraper } from './src/scrapers/yellow-pages-scraper.js';

const scraper = new YellowPagesScraper(browserPool, proxyManager, rateLimiter);

const result = await scraper.scrape({
  industry: 'hvac',
  location: 'Dallas, TX',
  max_results: 50,
});

if (result.success) {
  console.log(`Found ${result.data.length} businesses`);
  result.data.forEach((business) => {
    console.log(`${business.name} - ${business.phone}`);
    if (business.years_in_business) {
      console.log(`  Years in Business: ${business.years_in_business}`);
    }
  });
}
```

### Testing

```bash
npm run test:yellow-pages -- hvac "Dallas, TX" 10
```

### Rate Limits
- **Per minute:** 8 requests
- **Per hour:** 150 requests
- **Per day:** 500 requests
- **Concurrent browsers:** 2

### Data Quality Comparison

| Field | Yellow Pages | Google Maps |
|-------|-------------|-------------|
| Phone | 95%+ | 70-80% |
| Website | 85%+ | 60-70% |
| Address | 98%+ | 90%+ |
| Years in Business | 60%+ | 0% (N/A) |
| BBB Rating | 30%+ | 0% (N/A) |
| Services List | 40%+ | 0% (N/A) |

### Anti-Detection Measures
- Random delays (2-5 seconds between pages)
- Human-like scrolling
- Stealth mode browser configuration
- Proxy rotation
- Less aggressive than Google Maps

---

## 2. Google Maps Scraper (FALLBACK)

### Purpose
Searches Google Maps for businesses by location + industry. This is the **FALLBACK data source** when Yellow Pages fails or returns insufficient results.

### What It Extracts
- Company name
- Phone number
- Full address (street, city, state, zip)
- Website URL
- Business category
- Google Maps rating and review count
- Google Maps URL

### Usage

```typescript
import { GoogleMapsScraper } from './src/scrapers/google-maps-scraper.js';

const scraper = new GoogleMapsScraper(browserPool, proxyManager, rateLimiter);

const result = await scraper.scrape({
  query: 'HVAC companies in Dallas, TX',
  max_results: 50,
  min_rating: 3.5,
});

if (result.success) {
  console.log(`Found ${result.data.length} businesses`);
  result.data.forEach((business) => {
    console.log(`${business.name} - ${business.phone}`);
  });
}
```

### Testing

```bash
npm run test:google-maps -- "HVAC Dallas TX"
```

### Rate Limits
- **Per minute:** 30 requests
- **Per hour:** 500 requests
- **Per day:** 5,000 requests

### Known Issues
- Google Maps HTML selectors change frequently - monitor logs for extraction failures
- Some businesses don't have all fields (especially phone/website)
- Pagination may stop before max_results if end of list is reached

### Anti-Detection Measures
- Random delays (1-3 seconds between actions)
- Human-like scrolling
- Stealth mode browser configuration
- Proxy rotation

---

## 2. LinkedIn Company Scraper

### Purpose
Extracts detailed company information from LinkedIn company pages.

### What It Extracts
- Company name (verified)
- LinkedIn company URL
- Industry/sector
- Employee count
- Company website
- Company description

### Usage

```typescript
import { LinkedInCompanyScraper } from './src/scrapers/linkedin-company-scraper.js';

const scraper = new LinkedInCompanyScraper(browserPool, proxyManager, rateLimiter);

const result = await scraper.scrape({
  company_name: 'ABC HVAC Dallas',
});

if (result.success && result.data) {
  console.log(`Company: ${result.data.name}`);
  console.log(`Employees: ${result.data.employee_count}`);
  console.log(`Website: ${result.data.website}`);
}
```

### Testing

```bash
npm run test:linkedin-company -- "Microsoft"
```

### Rate Limits
- **Per minute:** 2 requests (VERY conservative)
- **Per hour:** 60 requests
- **Per day:** 400 requests

### LinkedIn Bot Detection

LinkedIn has AGGRESSIVE bot detection. Follow these guidelines:

1. **Use Proxies:** Residential proxies work best
2. **Low Volume:** Don't exceed 2 requests/minute
3. **Expect Login Walls:** Without authentication, scraper may hit login walls
4. **Session Cookies:** For production, implement LinkedIn session cookie storage (out of MVP scope)

### Known Limitations
- May encounter login wall without authentication
- HTML selectors break frequently when LinkedIn updates their UI
- Returns partial data if login wall encountered

---

## 3. LinkedIn People Scraper

### Purpose
Finds decision makers (owners, CEOs, managers) at target companies.

### What It Extracts
- Full name
- Job title
- Company name (verified)
- LinkedIn profile URL

### Usage

```typescript
import { LinkedInPeopleScraper } from './src/scrapers/linkedin-people-scraper.js';

const scraper = new LinkedInPeopleScraper(browserPool, proxyManager, rateLimiter);

const result = await scraper.scrape({
  company_name: 'ABC HVAC Dallas',
  job_titles: ['Owner', 'CEO', 'President', 'Manager'],
  max_results: 5,
});

if (result.success) {
  result.data.forEach((person) => {
    console.log(`${person.full_name} - ${person.title}`);
  });
}
```

### Testing

```bash
npm run test:linkedin-people -- "Microsoft" "CEO,President"
```

### Rate Limits
- **Per minute:** 2 requests
- **Per hour:** 40 requests
- **Per day:** 200 requests

### Important Notes
- EVEN MORE aggressive detection than company scraper
- Searches are done from search results page (doesn't visit individual profiles)
- Longer delays (4-6 seconds) between requests
- May need authentication for consistent results

---

## 4. Email Finder

### Purpose
Finds/generates email addresses for decision makers using multiple strategies.

### Strategies

1. **Pattern Matching:** Generate common email formats
   - `firstname@domain.com`
   - `firstname.lastname@domain.com`
   - `firstnamelastname@domain.com`
   - `flastname@domain.com`

2. **Website Scraping:** Search company website for emails
   - Contact pages
   - About pages
   - Team pages

3. **Hunter.io API:** Verify emails (if API key provided)
   - Free tier: 100 verifications/month
   - Checks deliverability

### What It Returns
- Email address
- Confidence level (high/medium/low)
- Source (website/pattern/api)
- Verified status (boolean)

### Usage

```typescript
import { EmailFinder } from './src/scrapers/email-finder.js';

const scraper = new EmailFinder(browserPool, proxyManager, rateLimiter);

const result = await scraper.scrape({
  domain: 'example.com',
  person_names: [
    { first_name: 'John', last_name: 'Doe' },
    { first_name: 'Jane', last_name: 'Smith' },
  ],
  search_website: true,
  use_hunter_api: true,
});

if (result.success) {
  const highConfidence = result.data.filter((e) => e.confidence === 'high');
  console.log(`Found ${highConfidence.length} high-confidence emails`);
}
```

### Testing

```bash
npm run test:email-finder -- "microsoft.com" "John Doe,Jane Smith"
```

### Hunter.io Setup (Optional)

1. Sign up at https://hunter.io
2. Get free API key (100 verifications/month)
3. Add to `.env`:
   ```
   HUNTER_API_KEY=your_key_here
   ```

### Confidence Levels
- **High:** Found on website OR verified by Hunter.io
- **Medium:** Pattern match + Hunter indicates possible
- **Low:** Pattern guess, unverified

---

## 5. Website Scraper

### Purpose
Extracts additional contact information and metadata from company websites.

### What It Extracts
- Contact emails (from contact/about pages)
- Phone numbers (formatted)
- Employee names (from team pages)
- Services offered (from services pages)
- Social media links (Facebook, Twitter, LinkedIn, Instagram)

### Usage

```typescript
import { WebsiteScraper } from './src/scrapers/website-scraper.js';

const scraper = new WebsiteScraper(browserPool, proxyManager, rateLimiter);

const result = await scraper.scrape({
  website_url: 'https://example.com',
});

if (result.success && result.data) {
  console.log(`Emails: ${result.data.emails.join(', ')}`);
  console.log(`Phones: ${result.data.phones.join(', ')}`);
  console.log(`Employees: ${result.data.employee_names.length}`);
  console.log(`Services: ${result.data.services.length}`);
}
```

### Testing

```bash
npm run test:website-scraper -- "https://www.microsoft.com"
```

### Pages Scraped
- Homepage
- /contact, /contact-us
- /about, /about-us
- /team, /our-team
- /services, /what-we-do

### Timeouts
- 10 seconds per page
- Returns partial results if some pages timeout

---

## Configuration

### Proxy Configuration

Edit `config/proxies.json`:

```json
{
  "provider": "brightdata",
  "rotation_strategy": "round_robin",
  "proxies": [
    {
      "host": "proxy.example.com",
      "port": 8080,
      "username": "user",
      "password": "pass",
      "protocol": "http",
      "country": "US",
      "enabled": true,
      "last_used": null,
      "failure_count": 0
    }
  ],
  "health_check_interval_minutes": 30,
  "max_failures_before_disable": 5
}
```

### Rate Limit Configuration

Edit `config/scraper-limits.json`:

```json
{
  "yellow_pages": {
    "requests_per_minute": 8,
    "requests_per_hour": 150,
    "requests_per_day": 500,
    "concurrent_browsers": 2,
    "notes": "PRIMARY data source - less aggressive than Google Maps"
  },
  "google_maps": {
    "requests_per_minute": 10,
    "requests_per_hour": 200,
    "requests_per_day": 2000,
    "concurrent_browsers": 2,
    "notes": "FALLBACK source - Conservative limits"
  },
  "linkedin_company": {
    "requests_per_minute": 5,
    "requests_per_hour": 100,
    "requests_per_day": 500,
    "concurrent_browsers": 1
  },
  "linkedin_people": {
    "requests_per_minute": 3,
    "requests_per_hour": 60,
    "requests_per_day": 300,
    "concurrent_browsers": 1
  },
  "email_finder": {
    "requests_per_minute": 15,
    "requests_per_hour": 300,
    "requests_per_day": 3000,
    "concurrent_browsers": 2
  }
}
```

---

## Integration with MCP Tools

### search_companies Tool (UPDATED)
- Uses **Yellow Pages Scraper** (PRIMARY)
- Falls back to **Google Maps Scraper** if Yellow Pages fails
- Stores results in database with source tracking
- Returns formatted company list

### find_decision_makers Tool
- Uses **LinkedIn People Scraper**
- Optionally uses **Email Finder** for emails
- Links decision makers to companies in database

### enrich_company Tool
- Uses **LinkedIn Company Scraper** for company data
- Uses **Website Scraper** for additional contact info
- Uses **Email Finder** for emails
- Updates existing company records

---

## Error Handling

All scrapers follow the same error handling pattern:

```typescript
const result = await scraper.scrape(params);

if (!result.success) {
  console.error(`Error: ${result.error}`);
  console.log(`Retries: ${result.retry_count}`);
  console.log(`Duration: ${result.duration_ms}ms`);
  // Handle error
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Rate limit exceeded | Too many requests | Wait for retry_after_ms |
| Timeout | Slow network/site | Increase timeout or retry |
| No results found | Query too specific | Broaden search parameters |
| Login wall (LinkedIn) | No authentication | Implement session cookies or reduce frequency |
| Proxy failed | Bad proxy | Check proxy configuration |
| Selector not found | Site HTML changed | Update selectors in scraper code |

---

## Best Practices

### 1. Start Slow
- Test with small max_results first
- Monitor logs for errors
- Gradually increase volume

### 2. Use Proxies
- Required for LinkedIn
- Recommended for high-volume Google Maps scraping
- Residential proxies work best

### 3. Monitor Rate Limits
- Check logs for rate limit warnings
- Adjust rate limits if hitting limits frequently
- Use `get-scraping-stats` tool to monitor usage

### 4. Database Storage
- Always store scraped data in database
- Prevents need to re-scrape
- Enables offline/cached lookups

### 5. Error Recovery
- Scrapers have automatic retry logic
- Check logs to identify persistent issues
- Fallback to database data when scraping fails

---

## Maintenance

### When Selectors Break

If scraping stops working:

1. Check logs for "could not extract" warnings
2. Open site in browser and inspect HTML
3. Update selectors in scraper file
4. Test with standalone test script
5. Re-run MCP tool

### Updating Selectors

Example for Google Maps:

```typescript
// OLD (broken)
const nameElement = card.locator('h3').first();

// NEW (updated)
const nameElement = card.locator('[data-item-id*="title"]').first();
```

### Monitoring Health

```bash
# Check scraper usage
npm run test:google-maps -- "test query"

# Check database stats
npm run db:stats

# Check logs
cat logs/prospect-finder.log
```

---

## Limitations & Future Enhancements

### Current Limitations
1. LinkedIn requires authentication for consistent results
2. HTML selectors break when sites update
3. No CAPTCHA solving
4. Single-threaded scraping (one browser at a time per scraper)

### Planned Enhancements
1. LinkedIn session management
2. CAPTCHA solving integration
3. Multi-threaded scraping
4. Auto-retry with updated selectors
5. More data sources (Yelp, industry directories)
6. ~~Yellow Pages integration~~ **COMPLETED (2025-10-17)**

---

## Troubleshooting

### Scraping Returns Empty Results

1. Check rate limits: `rateLimiter.getUsageStats()`
2. Verify proxy is working: Check proxy-manager logs
3. Test manually: Run standalone test script with headless=false
4. Check site accessibility: Try visiting site in regular browser

### Slow Performance

1. Reduce max_results
2. Increase timeout values
3. Check network latency to proxies
4. Use multiple browsers (increase concurrent_browsers in rate-limit config)

### Getting Blocked

1. Add more proxies
2. Reduce request frequency
3. Increase delays between requests
4. Use residential proxies instead of datacenter

---

## Support

For issues, check:
1. Logs: `logs/prospect-finder.log`
2. Test scripts: `npm run test:*`
3. Database: `npm run db:stats`
4. MCP server status: Check Claude Desktop logs

---

**Last Updated:** 2025-01-17
