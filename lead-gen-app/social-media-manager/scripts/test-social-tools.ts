import {
  generatePosts,
  generateThread,
  researchHashtags,
  buildAnalyticsSnapshot,
  monitorTrends,
  optimizeTiming,
  analyzeCompetitors,
  buildContentCalendar,
} from '../src/ai/generator.js';
import {
  determinePositionRecommendation,
  formatPriceRange,
  generatePricingSnapshot,
} from '../src/analytics/pricing-intelligence.js';
type DividerLevel = 'section' | 'block';

function divider(title: string, level: DividerLevel = 'section'): void {
  const line = level === 'section' ? '='.repeat(64) : '-'.repeat(64);
  console.log(`\n${line}`);
  console.log(title.toUpperCase());
  console.log(line);
}

function formatList(values: string[]): string {
  return values.join(', ');
}

function runPostGenerationSmokeTest(): void {
  divider('Post generation');

  const result = generatePosts({
    topic: 'HVAC maintenance playbook',
    platforms: ['linkedin', 'twitter'],
    tone: 'educational',
    goal: 'engagement',
    includeHashtags: true,
    includeEmojis: false,
    audience: 'service contractors',
  });

  console.log('Posts created:', result.posts.length);
  console.log('Estimated performance:', result.estimatedPerformance);
  console.log('Sample platform:', result.posts[0].platform);
  console.log('Sample CTA:', result.posts[0].content.split('\n').slice(-1)[0]);
}

function runThreadSmokeTest(): void {
  divider('Thread generation');

  const thread = generateThread({
    topic: 'Seasonal marketing plan',
    platform: 'twitter',
    threadLength: 4,
    tone: 'professional',
    includeHook: true,
  });

  console.log('Hook present:', thread.hook !== null);
  console.log('Posts in thread:', thread.posts.length);
  console.log('Closing remark snippet:', thread.closingRemark);
}

function runHashtagSmokeTest(): void {
  divider('Hashtag research');

  const hashtags = researchHashtags({
    topic: 'lead generation',
    platform: 'linkedin',
    count: 5,
    strategy: 'niche',
  });

  console.log('Top picks:', hashtags.topPicks.join(', '));
  console.log('Strategy recommendations:', hashtags.strategyRecommendations.length);
}

function runAnalyticsSmokeTest(): void {
  divider('Analytics snapshot');

  const analytics = buildAnalyticsSnapshot({
    dateRange: '30d',
  });

  console.log('Platforms analysed:', analytics.summary.platformsAnalyzed);
  console.log('Average engagement rate (%):', analytics.summary.averageEngagementRate);
  console.log('Primary insight:', analytics.insights[0]);
}

function runTrendMonitoringSmokeTest(): void {
  divider('Trend monitoring');

  const trend = monitorTrends({
    industry: 'home services',
    platform: 'facebook',
    includeCompetitors: true,
  });

  console.log('Trending topics:', trend.trendingTopics.length);
  console.log('Alerts detected:', trend.alerts.length);
}

function runTimingOptimizationSmokeTest(): void {
  divider('Timing optimisation');

  const timing = optimizeTiming({
    platform: 'linkedin',
    audienceTimezone: 'America/Chicago',
    contentType: 'promotional',
  });

  console.log('Peak windows:', timing.engagementWindows.peak.join(', '));
  console.log('Recommendation count:', timing.recommendations.length);
}

function runCompetitorAnalysisSmokeTest(): void {
  divider('Competitor analysis');

  const analysis = analyzeCompetitors({
    competitors: ['@hvacgrowth', '@contractorcoach'],
    platform: 'linkedin',
    depth: 'detailed',
  });

  console.log('Profiles compared:', analysis.competitorProfiles.length);
  console.log('Opportunity highlight:', analysis.comparativeAnalysis.opportunities[0]);
}

function runCompetitorPricingSmokeTest(): void {
  divider('Competitor pricing intelligence');

  const snapshots = [
    generatePricingSnapshot('HVAC Growth Lab', 'Monthly Content Management'),
    generatePricingSnapshot('Local Visibility Pros', 'Paid Campaign Management'),
  ];

  console.log('Services tracked:', snapshots.length);
  console.log('Sample range:', formatPriceRange(snapshots[0].priceLow, snapshots[0].priceHigh, snapshots[0].currency));
  console.log('Pricing model mix:', snapshots.map((s) => s.pricingModel).join(', '));
}

function runMarketPositionSmokeTest(): void {
  divider('Market position benchmarking');

  const baseline = generatePricingSnapshot('Basemap Agency', 'Monthly Content Management');
  const competitorAverage = (baseline.priceLow + baseline.priceHigh) / 2;
  const assessment = determinePositionRecommendation(competitorAverage * 0.85, competitorAverage);

  console.log('Baseline average price:', Math.round(competitorAverage));
  console.log('Position call:', assessment.position);
  console.log('Recommendation snippet:', assessment.recommendation.split('.')[0]);
}

function runContentCalendarSmokeTest(): void {
  divider('Content calendar');

  const calendar = buildContentCalendar({
    durationWeeks: 2,
    platforms: ['linkedin', 'twitter'],
    postsPerWeek: 3,
    contentThemes: ['case study', 'playbook', 'customer spotlight'],
    businessGoals: ['lead generation'],
  });

  console.log('Weeks generated:', calendar.calendar.length);
  console.log('Content mix keys:', Object.keys(calendar.contentMix).join(', '));
  console.log('Posting schedule (linkedin):', formatList(calendar.postingSchedule.linkedin));
}

function main(): void {
  divider('Social media manager deterministic smoke test');

  runPostGenerationSmokeTest();
  runThreadSmokeTest();
  runHashtagSmokeTest();
  runAnalyticsSmokeTest();
  runTrendMonitoringSmokeTest();
  runTimingOptimizationSmokeTest();
  runCompetitorAnalysisSmokeTest();
  runCompetitorPricingSmokeTest();
  runMarketPositionSmokeTest();
  runContentCalendarSmokeTest();

  divider('Smoke test complete', 'block');
}

try {
  main();
} catch (error) {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
}
