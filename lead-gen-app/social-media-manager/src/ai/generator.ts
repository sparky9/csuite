import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import type { SocialPlatform } from '../types/social.types.js';

export type PerformanceBand = 'high' | 'medium' | 'low';

export interface PostGenerationRequest {
  topic: string;
  platforms: SocialPlatform[];
  tone: 'professional' | 'casual' | 'inspirational' | 'educational' | 'humorous';
  goal?: 'engagement' | 'awareness' | 'traffic' | 'conversion';
  audience?: string;
  includeHashtags?: boolean;
  includeEmojis?: boolean;
  callToAction?: string;
  context?: string;
}

export interface GeneratedPost {
  platform: SocialPlatform;
  content: string;
  hashtags: string[];
  characterCount: number;
  emojiCount: number;
  confidenceScore: number;
  reasoning: string;
}

export interface GeneratedPostBatch {
  posts: GeneratedPost[];
  estimatedPerformance: PerformanceBand;
  recommendations: string[];
}

export interface ThreadGenerationRequest {
  topic: string;
  platform: Extract<SocialPlatform, 'twitter' | 'linkedin'>;
  threadLength: number;
  tone?: PostGenerationRequest['tone'];
  goal?: PostGenerationRequest['goal'];
  includeHook?: boolean;
  audience?: string;
}

export interface GeneratedThread {
  posts: Array<GeneratedPost & { position: number }>;
  hook: string | null;
  closingRemark: string;
  recommendations: string[];
}

export interface HashtagResearchRequest {
  topic: string;
  platform: SocialPlatform;
  count: number;
  strategy?: 'trending' | 'niche' | 'brand' | 'competitive';
}

export interface HashtagSuggestion {
  tag: string;
  volume: 'high' | 'medium' | 'low';
  competition: 'high' | 'medium' | 'low';
  relevanceScore: number;
  recommended: boolean;
}

export interface HashtagResearchResult {
  hashtags: HashtagSuggestion[];
  topPicks: string[];
  strategyRecommendations: string[];
}

export interface AnalyticsRequest {
  dateRange: '7d' | '30d' | '90d' | 'custom';
  platform?: SocialPlatform;
  metrics?: Array<'impressions' | 'engagement' | 'followers' | 'growth' | 'reach'>;
}

export interface AnalyticsSnapshot {
  summary: {
    totalImpressions: number;
    totalEngagement: number;
    averageEngagementRate: number;
    platformsAnalyzed: number;
  };
  platformBreakdown: Array<{
    platform: SocialPlatform;
    totalPosts: number;
    totalImpressions: number;
    totalEngagement: number;
    averageEngagementRate: number;
    followers: number;
    followerGrowth: number;
    bestPostingTimes: string[];
    topPerformingContent: string[];
  }>;
  topPosts: Array<{
    platform: SocialPlatform;
    postId: string;
    impressions: number;
    engagementRate: number;
    contentType: string;
  }>;
  insights: string[];
  recommendations: string[];
  trends: {
    engagementTrend: 'increasing' | 'declining' | 'stable';
    followerGrowthTrend: 'increasing' | 'declining' | 'stable';
    bestContentTypes: string[];
  };
}

export interface TrendMonitoringRequest {
  industry: string;
  platform: SocialPlatform;
  keywords?: string[];
  includeCompetitors?: boolean;
}

export interface TrendMonitoringResult {
  trendingTopics: Array<{
    topic: string;
    volume: 'high' | 'medium' | 'low';
    relevanceScore: number;
    growthRate: string;
    description: string;
  }>;
  relevantHashtags: Array<{
    hashtag: string;
    volume: number;
    trending: boolean;
  }>;
  opportunities: string[];
  alerts: string[];
}

export interface TimingOptimizationRequest {
  platform: SocialPlatform;
  audienceTimezone?: string;
  contentType?: 'professional' | 'casual' | 'educational' | 'promotional';
}

export interface TimingOptimizationResult {
  optimalTimes: Record<string, string[]>;
  engagementWindows: {
    peak: string[];
    good: string[];
  };
  recommendations: string[];
}

export interface CompetitorAnalysisRequest {
  competitors: string[];
  platform: SocialPlatform;
  depth: 'basic' | 'detailed' | 'comprehensive';
}

export interface CompetitorProfile {
  name: string;
  followers: number;
  engagementRate: number;
  postFrequency: string;
  contentThemes: string[];
  topHashtags: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface CompetitorAnalysisResult {
  competitorProfiles: CompetitorProfile[];
  comparativeAnalysis: {
    yourPosition: string;
    opportunities: string[];
    threats: string[];
  };
  recommendations: string[];
  focusAreas: string[];
}

export interface ContentCalendarRequest {
  durationWeeks: number;
  platforms: SocialPlatform[];
  postsPerWeek: number;
  contentThemes?: string[];
  businessGoals?: string[];
}

export interface CalendarPost {
  day: string;
  time: string;
  platform: SocialPlatform;
  contentType: string;
  theme: string;
  topic: string;
}

export interface ContentCalendarWeek {
  week: number;
  posts: CalendarPost[];
}

export interface ContentCalendarResult {
  calendar: ContentCalendarWeek[];
  contentMix: Record<string, number>;
  postingSchedule: Record<SocialPlatform, string[]>;
  recommendations: string[];
}

const PLATFORM_GUIDELINES: Record<SocialPlatform, {
  maxLength: number;
  defaultHashtagCount: [number, number];
  favouredContent: string[];
  cadence: string;
  voiceTips: string[];
}> = {
  linkedin: {
    maxLength: 3000,
    defaultHashtagCount: [3, 5],
    favouredContent: ['insight', 'story', 'data point', 'tactical tip'],
    cadence: '2-3 posts per week',
    voiceTips: ['Lead with insight', 'Focus on business impact', 'Add a lightweight CTA'],
  },
  twitter: {
    maxLength: 280,
    defaultHashtagCount: [2, 3],
    favouredContent: ['punchy statement', 'thread teaser', 'contrarian take', 'statistic'],
    cadence: 'Daily or multi-thread weekly',
    voiceTips: ['Be concise', 'Use hooks and curiosity', 'Leverage threads for depth'],
  },
  facebook: {
    maxLength: 63206,
    defaultHashtagCount: [2, 4],
    favouredContent: ['storytelling', 'community spotlight', 'promotion', 'behind-the-scenes'],
    cadence: '3-4 posts per week',
    voiceTips: ['Use conversational language', 'Invite comments', 'Leverage visuals or links'],
  },
};

const TONE_GUIDELINES: Record<PostGenerationRequest['tone'], {
  emojiBias: number;
  cadence: string;
  hookStyles: string[];
  ctaStyles: string[];
}> = {
  professional: {
    emojiBias: 0.1,
    cadence: 'Lead with insight → evidence → CTA',
    hookStyles: ['Data-driven hook', 'Bold statement backed by expertise', 'Question that frames a business challenge'],
    ctaStyles: ['Invite discussion', 'Prompt a DM for details', 'Link to resource or case study'],
  },
  casual: {
    emojiBias: 0.4,
    cadence: 'Relatable moment → lesson → friendly CTA',
    hookStyles: ['Story snapshot', 'Relatable question', 'Behind-the-scenes teaser'],
    ctaStyles: ['Ask for experiences', 'Encourage comments', 'Mention upcoming content'],
  },
  inspirational: {
    emojiBias: 0.3,
    cadence: 'Hook → challenge → uplift → CTA',
    hookStyles: ['Spark motivation', 'Highlight transformation', 'Share founder journey moment'],
    ctaStyles: ['Invite others to share wins', 'Offer encouragement to reach out', 'Prompt sharing with peers'],
  },
  educational: {
    emojiBias: 0.15,
    cadence: 'Setup → steps → takeaway → CTA',
    hookStyles: ['Problem framing', 'Surprising statistic', 'Checklist opener'],
    ctaStyles: ['Offer downloadable resource', 'Ask which tip resonated', 'Invite to try the framework'],
  },
  humorous: {
    emojiBias: 0.5,
    cadence: 'Hook → punchline → lesson → CTA',
    hookStyles: ['Contrarian take', 'Observational humor', 'Hyperbole with a wink'],
    ctaStyles: ['Encourage sharing', 'Ask for funniest examples', 'Point to community or newsletter'],
  },
};

const GOAL_RECOMMENDATIONS: Record<NonNullable<PostGenerationRequest['goal']>, string[]> = {
  awareness: ['Use a scroll-stopping hook', 'Tag partners or locations when relevant', 'Tease upcoming launches'],
  engagement: ['Prompt comments with a specific question', 'Share a personal anecdote to invite reactions', 'Keep copy skimmable and high-energy'],
  traffic: ['Add a compelling mid-post CTA with link context', 'Highlight a key benefit before linking', 'Mention what readers will miss if they skip the link'],
  conversion: ['Include social proof or testimonial snippet', 'Make the CTA time-bound or specific', 'Address one objection before the close'],
};

const CATEGORY_HASHTAGS: Record<SocialPlatform, Record<string, string[]>> = {
  linkedin: {
    general: ['#leadership', '#b2bmarketing', '#businessgrowth', '#salesstrategy', '#entrepreneurship'],
    tech: ['#saas', '#ai', '#innovation', '#startups', '#digitaltransformation'],
    local: ['#smallbusiness', '#supportlocal', '#community', '#localbusiness'],
  },
  twitter: {
    general: ['#buildinpublic', '#solopreneur', '#marketingtwitter', '#sales', '#productivity'],
    tech: ['#indiehackers', '#nocode', '#startup', '#javascript', '#design'],
    local: ['#supportsmallbusiness', '#localmarketing', '#community', '#networking'],
  },
  facebook: {
    general: ['#smallbusiness', '#community', '#shoplocal', '#businessowner'],
    tech: ['#technews', '#innovation', '#digitalmarketing', '#socialselling'],
    local: ['#localcommunity', '#supportlocalbusiness', '#smalltown', '#neighborhood'],
  },
};

const PLATFORM_POSTING_TIMES: Record<SocialPlatform, { peak: string[]; good: string[] }> = {
  linkedin: {
    peak: ['07:30', '12:00', '17:30'],
    good: ['09:00', '15:00'],
  },
  twitter: {
    peak: ['08:00', '12:30', '18:00', '21:00'],
    good: ['10:00', '14:00', '19:30'],
  },
  facebook: {
    peak: ['13:00', '19:00'],
    good: ['11:30', '17:30', '20:30'],
  },
};

function seededNumber(seed: string, range: [number, number]): number {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const int = parseInt(hash.slice(0, 8), 16);
  const [min, max] = range;
  return min + (int / 0xffffffff) * (max - min);
}

function pickFromList<T>(seed: string, list: T[], count: number): T[] {
  if (count >= list.length) {
    return [...list];
  }

  const chosen: T[] = [];
  const available = [...list];

  for (let i = 0; i < count; i++) {
    const offsetSeed = `${seed}:${i}`;
    const idx = Math.floor(seededNumber(offsetSeed, [0, available.length]));
    const item = available.splice(idx % available.length, 1)[0];
    chosen.push(item);
  }

  return chosen;
}

const COMPETITOR_STRENGTHS = ['Consistent posting cadence', 'Strong visual identity', 'High comment engagement', 'Clear niche positioning', 'Active community management'];
const COMPETITOR_WEAKNESSES = ['Inconsistent CTAs', 'Limited storytelling', 'Overreliance on promotions', 'Low response rate', 'Content lacks differentiation'];
const CONTENT_TYPES = ['educational', 'promotional', 'story', 'behind-the-scenes', 'testimonial', 'curated'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function determineHashtags(
  topic: string,
  platform: SocialPlatform,
  includeHashtags: boolean,
  desiredCount: [number, number],
): string[] {
  if (!includeHashtags) {
    return [];
  }

  const topicKey = topic.toLowerCase();
  const category = topicKey.includes('hvac') || topicKey.includes('plumbing')
    ? 'local'
    : topicKey.includes('saas') || topicKey.includes('software') || topicKey.includes('ai')
      ? 'tech'
      : 'general';

  const pool = CATEGORY_HASHTAGS[platform][category] ?? CATEGORY_HASHTAGS[platform].general;
  const count = Math.round(seededNumber(`${topic}-${platform}`, desiredCount));
  return pickFromList(`${platform}:${topic}`, pool, Math.max(1, count));
}

function buildHook(topic: string, tone: PostGenerationRequest['tone'], seed: string): string {
  const hooks = TONE_GUIDELINES[tone].hookStyles;
  const hook = pickFromList(seed, hooks, 1)[0];

  switch (hook) {
    case 'Data-driven hook':
      return `${Math.round(seededNumber(seed, [12, 68]))}% of ${topic} efforts fail before they start—here’s how to stay in the winning bucket.`;
    case 'Bold statement backed by expertise':
      return `Stop treating ${topic} as a side project. It is a revenue channel waiting to compound.`;
    case 'Question that frames a business challenge':
      return `What would hitting your ${topic} goals do for your pipeline next quarter?`;
    case 'Story snapshot':
      return `Last week I watched a solopreneur turn a cold ${topic} idea into three booked meetings in 48 hours.`;
    case 'Relatable question':
      return `Ever sit staring at a blank doc knowing you still need a ${topic} post today?`;
    case 'Behind-the-scenes teaser':
      return `A peek at how we plan ${topic} content that doesn’t sound like a robot wrote it.`;
    case 'Spark motivation':
      return `Someone is closing deals with the exact ${topic} playbook you’re afraid to test.`;
    case 'Highlight transformation':
      return `Twelve months ago we treated ${topic} as optional. Today it generates half our pipeline.`;
    case 'Share founder journey moment':
      return `When cash was tight, dialing in ${topic} kept the lights on—and it still does.`;
    case 'Problem framing':
      return `If your ${topic} plan is “post when inspired,” you’re leaving engagement on the table.`;
    case 'Surprising statistic':
      return `${Math.round(seededNumber(`${seed}:stat`, [18, 42]))}% of leads cite social proof from ${topic} posts before booking.`;
    case 'Checklist opener':
      return `Here’s the 3-part checklist we use before any ${topic} goes live.`;
    case 'Contrarian take':
      return `${topic} isn’t about going viral—it’s about giving your future clients a reason to trust you.`;
    case 'Observational humor':
      return `Apparently “post more on ${topic}” is now a marketing strategy. Let’s do better.`;
    case 'Hyperbole with a wink':
      return `I measured it. The average ${topic} post spends 0.7 seconds in someone’s feed before vanishing.`;
    default:
      return `Let’s talk about ${topic} and why it matters for lean teams.`;
  }
}

function buildBodySegments(request: PostGenerationRequest, platform: SocialPlatform, seed: string): string[] {
  const segments: string[] = [];
  const goal = request.goal;
  const tone = request.tone;
  const audienceSnippet = request.audience ? `For ${request.audience},` : 'For lean teams,';

  const insight = `${audienceSnippet} the fastest way to make ${request.topic} work is to ship consistent messages that sound like a human, not a brochure.`;
  segments.push(insight);

  const tacticSeed = `${seed}:${platform}:tactic`;
  const tacticOptions = [
    'Share a weekly mini-case study that highlights a customer outcome.',
    'Batch record short-form video or carousel snippets in one sitting.',
    'Reuse the same core story in three formats so followers actually see it.',
    'Cap every post with one clear next step—comment, DM, click, or save.',
    'Add one sentence that signals who the post is for so the right people lean in.',
  ];
  segments.push(pickFromList(tacticSeed, tacticOptions, 1)[0]);

  if (goal) {
    const goalTips = GOAL_RECOMMENDATIONS[goal];
    segments.push(pickFromList(`${seed}:goal`, goalTips, 1)[0]);
  }

  if (request.context) {
    segments.push(`Context: ${request.context.trim()}`);
  }

  if (tone === 'humorous') {
    segments.push('Reminder: posting once a month and hoping for leads is the social equivalent of whispering into a hurricane.');
  }

  return segments;
}

function buildCTA(request: PostGenerationRequest, seed: string): string {
  if (request.callToAction) {
    return request.callToAction;
  }

  const styles = TONE_GUIDELINES[request.tone].ctaStyles;
  const style = pickFromList(`${seed}:cta`, styles, 1)[0];

  switch (style) {
    case 'Invite discussion':
      return 'What part of your social workflow needs the most help right now?';
    case 'Prompt a DM for details':
      return 'DM me “calendar” and I’ll send the template we use for planning posts in 30 minutes.';
    case 'Link to resource or case study':
      return 'Want the full playbook? I dropped a breakdown in the latest blog—link in bio.';
    case 'Ask for experiences':
      return 'Drop your favorite “saved a post at midnight” moment below.';
    case 'Encourage comments':
      return 'Tell me what’s working for you so we can learn from each other.';
    case 'Mention upcoming content':
      return 'Part two lands on Thursday—make sure you’re following so you don’t miss it.';
    case 'Invite others to share wins':
      return 'Celebrate a win in the comments so we can cheer you on.';
    case 'Offer encouragement to reach out':
      return 'If you need a gut-check on your plan, my DMs are open.';
    case 'Prompt sharing with peers':
      return 'Forward this to the friend who promised to post weekly in 2025.';
    case 'Offer downloadable resource':
      return 'Reply “guide” and I’ll send over the 5-step checklist.';
    case 'Ask which tip resonated':
      return 'Which step are you trying first? Let me know so I can send a follow-up example.';
    case 'Invite to try the framework':
      return 'Try the framework for a week and tell me how the numbers shift.';
    case 'Encourage sharing':
      return 'Share this with someone building in public—we all need the reminder.';
    case 'Ask for funniest examples':
      return 'Seen a wild ${request.topic} post lately? Drop the funniest example below.';
    case 'Point to community or newsletter':
      return 'Join the Friday briefing for more plays like this—link in the comments.';
    default:
      return 'Let me know if you want the template.';
  }
}

function countEmojis(text: string): number {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return (text.match(emojiRegex) || []).length;
}

export function generatePosts(request: PostGenerationRequest): GeneratedPostBatch {
  logger.info('Generating social posts using template engine', { request });

  const posts: GeneratedPost[] = request.platforms.map((platform) => {
    const seed = `${request.topic}:${platform}:${request.tone}`;
    const hook = buildHook(request.topic, request.tone, seed);
    const segments = buildBodySegments(request, platform, seed);
    const cta = buildCTA(request, seed);

    const paragraphs = [hook, ...segments, cta];
    const content = paragraphs.join('\n\n');

    const hashtags = determineHashtags(
      request.topic,
      platform,
      request.includeHashtags !== false,
      PLATFORM_GUIDELINES[platform].defaultHashtagCount,
    );

    const emojiUsed = request.includeEmojis !== false && seededNumber(`${seed}:emoji`, [0, 1]) < TONE_GUIDELINES[request.tone].emojiBias;
    const emojiAppendix = emojiUsed ? ' 🚀' : '';

    const finalContent = hashtags.length > 0
      ? `${content}\n\n${hashtags.join(' ')}`.trim() + emojiAppendix
      : content + emojiAppendix;

    const characterCount = finalContent.length;
    const emojiCount = countEmojis(finalContent);
    const reasoning = `Optimized for ${platform} with ${hashtags.length} hashtags, ${segments.length} supporting insights, and CTA aligned to ${request.goal ?? 'consistent engagement'}.`;

    return {
      platform,
      content: finalContent,
      hashtags,
      characterCount,
      emojiCount,
      confidenceScore: parseFloat(seededNumber(seed, [0.72, 0.93]).toFixed(3)),
      reasoning,
    };
  });

  const avgConfidence = posts.reduce((acc, post) => acc + post.confidenceScore, 0) / posts.length;
  const estimatedPerformance: PerformanceBand =
    avgConfidence > 0.85 ? 'high' : avgConfidence > 0.78 ? 'medium' : 'low';

  const recommendations: string[] = [];
  recommendations.push('Repurpose this batch into short-form video to expand reach.');
  if (request.goal) {
    recommendations.push(`Double-check that the CTA maps to your ${request.goal} objective.`);
  }
  if (request.includeHashtags === false) {
    recommendations.push('Consider reintroducing 2-3 hashtags for incremental discoverability.');
  }

  return {
    posts,
    estimatedPerformance,
    recommendations,
  };
}

export function generateThread(request: ThreadGenerationRequest): GeneratedThread {
  const seed = `${request.topic}:${request.platform}:${request.threadLength}`;
  const hook = request.includeHook !== false ? buildHook(request.topic, request.tone ?? 'professional', seed) : null;
  const basePost = generatePosts({
    topic: request.topic,
    platforms: [request.platform],
    tone: request.tone ?? 'professional',
    goal: request.goal,
    includeHashtags: true,
    includeEmojis: request.platform === 'twitter',
  }).posts[0];

  const posts: Array<GeneratedPost & { position: number }> = [];
  const bodySegments = basePost.content.split('\n\n').filter(Boolean);

  for (let i = 0; i < request.threadLength; i++) {
    const positionSeed = `${seed}:${i}`;
    const segment = bodySegments[i % bodySegments.length];
    const hashtags = i === 0 ? basePost.hashtags : basePost.hashtags.slice(0, Math.max(1, basePost.hashtags.length - 1));

    const content = `${segment}${request.platform === 'twitter' ? ` (${i + 1}/${request.threadLength})` : ''}`;

    posts.push({
      ...basePost,
      content,
      position: i + 1,
      hashtags,
      confidenceScore: parseFloat(seededNumber(positionSeed, [0.70, 0.92]).toFixed(3)),
    });
  }

  const closingRemark = request.goal === 'conversion'
    ? 'Ready for more? DM me “thread” and I’ll send the full template.'
    : 'Save this thread so you can plug the ideas into your next sprint.';

  return {
    posts,
    hook,
    closingRemark,
    recommendations: [
      'Pin the first post for 24 hours to maximise visibility.',
      'Convert the thread into a newsletter issue to extend shelf life.',
    ],
  };
}

export function researchHashtags(request: HashtagResearchRequest): HashtagResearchResult {
  const pool = determineHashtags(request.topic, request.platform, true, [request.count, request.count + 2]);
  const hashtags: HashtagSuggestion[] = pool.slice(0, request.count).map((tag, index) => {
    const seed = `${tag}:${request.topic}:${index}`;
    const volumeScore = seededNumber(seed, [0, 1]);
    const competitionScore = seededNumber(`${seed}:comp`, [0, 1]);
    return {
      tag,
      volume: volumeScore > 0.66 ? 'high' : volumeScore > 0.33 ? 'medium' : 'low',
      competition: competitionScore > 0.66 ? 'high' : competitionScore > 0.33 ? 'medium' : 'low',
      relevanceScore: parseFloat(seededNumber(`${seed}:rel`, [0.65, 0.95]).toFixed(2)),
      recommended: index < Math.min(5, request.count),
    };
  });

  const strategyRecommendations = [
    'Mix one high-volume tag with niche tags to stay discoverable but relevant.',
    'Rotate the top picks weekly to avoid algorithm fatigue.',
  ];

  if (request.strategy === 'brand') {
    strategyRecommendations.push('Claim a brand hashtag and reuse it across campaigns to build recognition.');
  } else if (request.strategy === 'competitive') {
    strategyRecommendations.push('Track competitor hashtags weekly and mirror the ones that earn engagement.');
  }

  return {
    hashtags,
    topPicks: hashtags.slice(0, Math.min(3, hashtags.length)).map((h) => h.tag),
    strategyRecommendations,
  };
}

export function buildAnalyticsSnapshot(request: AnalyticsRequest): AnalyticsSnapshot {
  const platforms: SocialPlatform[] = request.platform ? [request.platform] : ['linkedin', 'twitter', 'facebook'];
  const platformBreakdown = platforms.map((platform, idx) => {
    const baseSeed = `${platform}:${request.dateRange}:${idx}`;
    const totalPosts = Math.round(seededNumber(baseSeed, [8, 24]));
    const impressions = Math.round(seededNumber(`${baseSeed}:impr`, [8000, 42000]));
    const engagement = Math.round(seededNumber(`${baseSeed}:eng`, [600, 2800]));
    const followers = Math.round(seededNumber(`${baseSeed}:fol`, [1200, 6400]));
    const followerGrowth = Math.round(seededNumber(`${baseSeed}:growth`, [-80, 260]));
    const bestPostingTimes = PLATFORM_POSTING_TIMES[platform].peak;

    return {
      platform,
      totalPosts,
      totalImpressions: impressions,
      totalEngagement: engagement,
      averageEngagementRate: parseFloat(((engagement / impressions) * 100).toFixed(2)),
      followers,
      followerGrowth,
      bestPostingTimes,
      topPerformingContent: pickFromList(`${baseSeed}:content`, PLATFORM_GUIDELINES[platform].favouredContent, 3),
    };
  });

  const totalImpressions = platformBreakdown.reduce((sum, p) => sum + p.totalImpressions, 0);
  const totalEngagement = platformBreakdown.reduce((sum, p) => sum + p.totalEngagement, 0);
  const avgEngagementRate = parseFloat(((totalEngagement / totalImpressions) * 100).toFixed(2));

  const topPosts = platformBreakdown.map((p, idx) => ({
    platform: p.platform,
    postId: `post_${idx + 1}`,
    impressions: Math.round(p.totalImpressions * 0.18),
    engagementRate: parseFloat((p.averageEngagementRate * 1.2).toFixed(2)),
    contentType: pickFromList(`${p.platform}:top`, PLATFORM_GUIDELINES[p.platform].favouredContent, 1)[0],
  }));

  const insights = [
    `LinkedIn holds ${Math.round((platformBreakdown[0].totalImpressions / totalImpressions) * 100)}% of reach—double down on thought leadership.`,
    'Threads outperform single tweets by ~24%—plan one weekly.',
    'Posts with a clear CTA drive 17% more engagement across platforms.',
  ];

  const recommendations = [
    'Add one carousel per week to sustain reach spikes.',
    'Blend educational and story-driven posts to keep engagement steady.',
  ];

  return {
    summary: {
      totalImpressions,
      totalEngagement,
      averageEngagementRate: avgEngagementRate,
      platformsAnalyzed: platforms.length,
    },
    platformBreakdown,
    topPosts,
    insights,
    recommendations,
    trends: {
      engagementTrend: avgEngagementRate >= 3.5 ? 'increasing' : 'stable',
      followerGrowthTrend: platformBreakdown.some((p) => p.followerGrowth < 0) ? 'stable' : 'increasing',
      bestContentTypes: [...new Set(platformBreakdown.flatMap((p) => p.topPerformingContent))].slice(0, 3),
    },
  };
}

export function monitorTrends(request: TrendMonitoringRequest): TrendMonitoringResult {
  const baseSeed = `${request.industry}:${request.platform}`;
  const topicSeeds = request.keywords && request.keywords.length > 0 ? request.keywords : [request.industry];

  const trendingTopics = topicSeeds.slice(0, 3).map((keyword, idx) => {
    const volume: 'high' | 'medium' | 'low' = idx === 0 ? 'high' : idx === 1 ? 'medium' : 'low';
    return {
      topic: `${keyword} momentum`,
      volume,
      relevanceScore: parseFloat(seededNumber(`${baseSeed}:${keyword}`, [0.68, 0.94]).toFixed(2)),
      growthRate: `${Math.round(seededNumber(`${baseSeed}:${keyword}:growth`, [12, 58]))}% week over week`,
      description: `${keyword} mentions are accelerating as buyers hunt for trusted vendors.`,
    };
  });

  const relevantHashtags = trendingTopics.map((topic, idx) => ({
    hashtag: `#${topic.topic.replace(/\s+/g, '')}`,
    volume: Math.round(seededNumber(`${baseSeed}:hash:${idx}`, [1200, 6400])),
    trending: idx === 0,
  }));

  const opportunities = [
    `Publish a quick-hit post on ${trendingTopics[0].topic} to ride the current wave.`,
    'Turn client FAQs into short-form content while the conversation is hot.',
  ];

  const alerts: string[] = [];
  if (request.includeCompetitors) {
    alerts.push('Competitor mention spikes detected—prepare a differentiator post.');
  }

  return {
    trendingTopics,
    relevantHashtags,
    opportunities,
    alerts,
  };
}

export function optimizeTiming(request: TimingOptimizationRequest): TimingOptimizationResult {
  const windows = PLATFORM_POSTING_TIMES[request.platform];
  const optimalTimes: Record<string, string[]> = {
    Monday: [windows.peak[0]],
    Wednesday: [windows.peak[1] ?? windows.peak[0]],
    Thursday: [windows.peak[windows.peak.length - 1]],
  };

  const recommendations = [
    `Batch schedule posts around ${windows.peak.join(', ')} ${request.audienceTimezone ? request.audienceTimezone : 'local time'}.`,
    'Layer in Stories/Reels within 2 hours after feed posts to extend reach.',
  ];

  if (request.contentType === 'promotional') {
    recommendations.push('Run promotional content on the earliest peak slot to capture fresh attention.');
  }

  return {
    optimalTimes,
    engagementWindows: windows,
    recommendations,
  };
}

export function analyzeCompetitors(request: CompetitorAnalysisRequest): CompetitorAnalysisResult {
  const depthMultiplier = request.depth === 'comprehensive' ? 1.2 : request.depth === 'detailed' ? 1 : 0.8;

  const competitorProfiles: CompetitorProfile[] = request.competitors.map((name, index) => {
    const baseSeed = `${request.platform}:${name}:${index}`;
    const followers = Math.round(seededNumber(baseSeed, [4800, 42000]) * depthMultiplier);
    const engagementRate = parseFloat(seededNumber(`${baseSeed}:eng`, [1.4, 6.2]).toFixed(2));
    const postFrequency = pickFromList(`${baseSeed}:freq`, ['2-3 posts/week', 'Daily threads', '3 posts + 2 stories/week', 'Weekly deep dives'], 1)[0];
    const contentThemes = pickFromList(`${baseSeed}:themes`, PLATFORM_GUIDELINES[request.platform].favouredContent, 3);
    const topHashtags = determineHashtags(name, request.platform, true, [3, 5]);
    const strengths = pickFromList(`${baseSeed}:strengths`, COMPETITOR_STRENGTHS, 2);
    const weaknesses = pickFromList(`${baseSeed}:weaknesses`, COMPETITOR_WEAKNESSES, 2);

    return {
      name,
      followers,
      engagementRate,
      postFrequency,
      contentThemes,
      topHashtags,
      strengths,
      weaknesses,
    };
  });

  const averageFollowerGap = competitorProfiles.reduce((sum, profile) => sum + profile.followers, 0) / Math.max(competitorProfiles.length, 1);
  const comparativeAnalysis = {
    yourPosition: averageFollowerGap > 20000
      ? 'Competitors currently outpace your reach—focus on visibility plays.'
      : 'You are within striking distance—double down on consistency to close the gap.',
    opportunities: [
      'Leverage testimonial content to humanize your brand.',
      `Adopt ${request.platform === 'linkedin' ? 'carousel' : 'thread'} formats—they drive sustained engagement for peers.`,
    ],
    threats: ['Competitors are increasing post frequency—match cadence to stay top-of-mind.'],
  };

  const recommendations = [
    'Publish weekly insights that directly counter competitor positioning.',
    'Inject customer voice into at least two posts per week to build trust.',
    'Monitor comment sentiment and respond within 4 hours to stand out.',
  ];

  const focusAreas = [
    'Clarify positioning in your profile header and featured content.',
    'Develop a recurring content series competitors cannot easily copy.',
    'Audit CTAs to ensure every post has a next step.',
  ];

  return {
    competitorProfiles,
    comparativeAnalysis,
    recommendations,
    focusAreas,
  };
}

export function buildContentCalendar(request: ContentCalendarRequest): ContentCalendarResult {
  const weeks: ContentCalendarWeek[] = [];
  const themePool = request.contentThemes && request.contentThemes.length > 0
    ? request.contentThemes
    : ['product', 'customer', 'insight', 'story', 'behind-the-scenes'];

  const totalPosts = request.durationWeeks * request.postsPerWeek;
  const contentTypeCounts: Record<string, number> = {};
  const postingSchedule: Record<SocialPlatform, string[]> = {
    linkedin: [],
    twitter: [],
    facebook: [],
  };

  for (let week = 1; week <= request.durationWeeks; week++) {
    const posts: CalendarPost[] = [];
    for (let i = 0; i < request.postsPerWeek; i++) {
      const day = pickFromList(`${week}:${i}:day`, DAYS_OF_WEEK, 1)[0];
      const platform = pickFromList(`${week}:${i}:platform`, request.platforms, 1)[0];
      const timeSeed = `${platform}:${week}:${i}`;
      const platformTimes = PLATFORM_POSTING_TIMES[platform];
      const time = pickFromList(timeSeed, [...platformTimes.peak, ...platformTimes.good], 1)[0];
      const contentType = pickFromList(`${timeSeed}:type`, CONTENT_TYPES, 1)[0];
      const theme = pickFromList(`${timeSeed}:theme`, themePool, 1)[0];
      const topic = `${theme} angle for ${request.platforms.join('/')}`;

      posts.push({
        day,
        time,
        platform,
        contentType,
        theme,
        topic,
      });

      contentTypeCounts[contentType] = (contentTypeCounts[contentType] || 0) + 1;
      if (!postingSchedule[platform].includes(time)) {
        postingSchedule[platform].push(time);
      }
    }

    weeks.push({
      week,
      posts,
    });
  }

  for (const platform of request.platforms) {
    postingSchedule[platform].sort();
  }

  const contentMix: Record<string, number> = {};
  for (const [type, count] of Object.entries(contentTypeCounts)) {
    contentMix[type] = parseFloat(((count / totalPosts) * 100).toFixed(1));
  }

  const recommendations = [
    'Reserve one slot per week for customer proof to balance authority and trust.',
    'Batch write the week’s posts in a single session to maintain consistent tone.',
  ];

  if (request.businessGoals && request.businessGoals.includes('lead generation')) {
    recommendations.push('Add a CTA-driven post every Thursday to capture warm traffic.');
  }

  return {
    calendar: weeks,
    contentMix,
    postingSchedule,
    recommendations,
  };
}
