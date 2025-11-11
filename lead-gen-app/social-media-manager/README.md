# Social Media Manager MCP

Deterministic social media management tools for solopreneurs. Generate posts, schedule content, analyze performance, research hashtags, and optimize your social media strategy without relying on external AI APIs.

## Features

- **Post Generation**: Platform-aware posts powered by deterministic templates and seeded randomness
- **Content Scheduling**: Schedule posts for optimal engagement windows across supported platforms
- **Performance Analytics**: Snapshot analytics, recommendations, and trend tracking without network calls
- **Hashtag Research**: Curated, repeatable hashtag suggestions tuned per platform and topic
- **Competitor Analysis**: Comparative breakdowns leveraging deterministic heuristics
- **Competitor Pricing Intelligence**: Track competitor rates and benchmark your pricing
- **Content Calendar**: Multi-week calendars with balanced content mix and CTA coverage
- **Timing Optimization**: Audience-aware posting windows derived from platform best practices
- **Trend Monitoring**: Industry and keyword trend detection for timely conversations
- **Thread Generation**: Structured multi-post threads tailored to Twitter and LinkedIn

## Installation

1. Navigate to the social-media-manager directory:

   ```bash
   cd social-media-manager
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with a valid `DATABASE_URL` if you want to persist results (Neon, Supabase, or local Postgres all work).

4. Set up the database (optional but recommended):

   ```bash
   npm run db:setup
   ```

   This applies the deterministic schema to the database referenced by `DATABASE_URL`.

5. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Development

Run in development mode with hot reload:

```bash
npm run dev
```

### Production

Build and run:

```bash
npm run build
npm start
```

### Testing

Run the smoke-test script to verify deterministic generators:

```bash
npm test
```

## Tools

### generate_post

Generate engaging social media posts optimized for specific platforms.

**Parameters:**

- `topic`: Post topic or subject
- `platforms`: Target platforms (linkedin, twitter, facebook)
- `tone`: Post tone (professional, casual, inspirational, educational, humorous)
- `audience`: Target audience (optional)
- `goal`: Post goal (optional)
- `include_hashtags`: Include hashtags (optional)
- `include_emojis`: Include emojis (optional)
- `call_to_action`: CTA text (optional)

### schedule_post

Schedule posts for optimal engagement times across multiple platforms.

**Parameters:**

- `content`: Post content text
- `platforms`: Target platforms
- `schedule_time`: When to post (ISO date or "optimal")
- `hashtags`: Hashtags array (optional)
- `media_urls`: Image/video URLs (optional)
- `thread_posts`: Additional posts for threads (optional)

### get_analytics

Retrieve performance analytics and insights for social media posts.

**Parameters:**

- `date_range`: Analytics period (7d, 30d, 90d, custom)
- `platform`: Specific platform (optional)
- `start_date`: Custom range start (optional)
- `end_date`: Custom range end (optional)
- `metrics`: Specific metrics to include (optional)

### research_hashtags

Research and suggest effective hashtags for increased reach.

**Parameters:**

- `topic`: Content topic or keyword
- `platform`: Target platform
- `count`: Number of hashtags (optional, default: 10)
- `strategy`: Hashtag strategy (optional)

### analyze_competitors

Analyze competitor social media strategies and performance.

**Parameters:**

- `competitors`: Array of competitor handles/names
- `platform`: Target platform
- `analysis_depth`: Depth level (optional)

### generate_content_calendar

Create a strategic content calendar for consistent posting.

**Parameters:**

- `duration_weeks`: Number of weeks to plan (1-12)
- `platforms`: Target platforms
- `posts_per_week`: Desired posts per week
- `content_themes`: Specific themes (optional)
- `business_goals`: Business objectives (optional)

### optimize_post_timing

Find the best times to post based on audience engagement data.

**Parameters:**

- `platform`: Target platform
- `audience_timezone`: Target timezone (optional)
- `content_type`: Content type (optional)

### monitor_trends

Monitor trending topics and conversations relevant to your brand.

**Parameters:**

- `industry`: Your industry or niche
- `platform`: Target platform
- `keywords`: Keywords to monitor (optional)
- `include_competitors`: Include competitor mentions (optional)

### monitor_competitor_pricing

Track competitor pricing for key services and capture historical changes.

**Parameters:**

- `userId`: User identifier (required)
- `competitorName`: Competitor business name (required)
- `competitorWebsite`: Competitor website or landing page (required)
- `servicesToTrack`: Array of services to record pricing for (optional)

### analyze_market_position

Compare your pricing against competitor averages and receive positioning guidance.

**Parameters:**

- `userId`: User identifier (required)
- `service`: Service name to compare (required)
- `yourPrice`: Your current price for the service (required)

### generate_thread

Generate multi-post threads for platforms like Twitter and LinkedIn.

**Parameters:**

- `topic`: Thread topic
- `platform`: Target platform (twitter or linkedin)
- `thread_length`: Number of posts (2-10)
- `tone`: Thread tone (optional)
- `goal`: Thread goal (optional)
- `include_hook`: Start with hook (optional)

## Configuration

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string. Required if you want to persist outputs; otherwise the server runs in memory.
- `LOG_LEVEL`: Logging level (`info` by default).
- `NODE_ENV`: Standard Node environment flag (optional).

See `.env.example` for a starter template.

### Logging

Logs are written to:

- `social-media-manager.log` (all logs)
- `social-media-manager-error.log` (errors only)
- `social-media-manager-exceptions.log` (uncaught exceptions)
- Console output with JSON-formatted messages

## Supported Platforms

- **LinkedIn**: Professional content, thought leadership, B2B marketing
- **Twitter**: Short-form content, real-time engagement, threads
- **Facebook**: Community building, longer-form content, visual storytelling

## Integration with Claude Desktop

This MCP server integrates with Claude Desktop to provide deterministic social media management tools directly in your AI workflow. Once running, you can use the tools in your conversations with Claude without configuring any external AI providers.

## License

ISC
