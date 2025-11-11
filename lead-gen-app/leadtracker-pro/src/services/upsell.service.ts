/**
 * Upsell opportunity detection and pitch generation service
 */

import { randomUUID } from 'crypto';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type {
  PitchTone,
  Prospect,
  UpsellDetectionResult,
  UpsellOpportunity,
  UpsellPitchResult,
} from '../types/leadtracker.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

interface UpsellPlay {
  service: string;
  keywords: string[];
  estimatedValue: number;
  defaultTalkingPoints: string[];
  focusArea: string;
}

const UPSELL_PLAYS: UpsellPlay[] = [
  {
    service: 'Content Writing Package',
    keywords: ['content', 'blog', 'article', 'copy', 'newsletter'],
    estimatedValue: 2000,
    defaultTalkingPoints: [
      'Transform SEO insights into consistent long-form assets',
      'Lightweight editorial calendar with headline suggestions',
      'Draft-to-publish support so your team only needs final approval',
    ],
    focusArea: 'content velocity',
  },
  {
    service: 'Advanced SEO Retainer',
    keywords: ['seo', 'search', 'ranking', 'backlink', 'keyword'],
    estimatedValue: 1800,
    defaultTalkingPoints: [
      'Quarterly technical audits to keep the site fast and healthy',
      'Fresh keyword clusters mapped to buyer intent journeys',
      'Monthly performance reviews with next-step backlog',
    ],
    focusArea: 'organic growth',
  },
  {
    service: 'Paid Ads Accelerator',
    keywords: ['ads', 'ppc', 'google ads', 'facebook ads', 'campaign'],
    estimatedValue: 1500,
    defaultTalkingPoints: [
      'Creative testing framework to ship new angles every month',
      'Weekly bid optimization and negative keyword sweeps',
      'Dashboard visibility on CAC and ROAS in plain language',
    ],
    focusArea: 'pipeline acceleration',
  },
  {
    service: 'Marketing Automation Setup',
    keywords: ['automation', 'drip', 'workflow', 'hubspot', 'crm'],
    estimatedValue: 2200,
    defaultTalkingPoints: [
      'Map lifecycle emails for onboarding, upsell, and win-back sequences',
      'Implement lead scoring tied to sales-ready signals',
      'Integrate CRM updates so nothing slips through the cracks',
    ],
    focusArea: 'lifecycle leverage',
  },
  {
    service: 'Customer Success Playbook',
    keywords: ['retention', 'renewal', 'success', 'churn', 'onboarding'],
    estimatedValue: 1400,
    defaultTalkingPoints: [
      'Codify onboarding milestones with proactive alerts',
      'Health dashboards that highlight churn signals early',
      'Quarterly business review scripts tailored to their goals',
    ],
    focusArea: 'retention lift',
  },
  {
    service: 'Maintenance & Support Plan',
    keywords: ['maintenance', 'support', 'bug', 'issue', 'ticket'],
    estimatedValue: 900,
    defaultTalkingPoints: [
      'Dedicated support channel with 48-hour response SLA',
      'Monthly preventative checks to catch issues early',
      'Quarterly roadmap sync aligned with their priorities',
    ],
    focusArea: 'operational stability',
  },
];

const TONE_SUBJECTS: Record<PitchTone, (company: string, service: string) => string> = {
  casual: (company, service) => `Idea for ${service.toLowerCase()} at ${company}`,
  professional: (company, service) => `${service} to extend results for ${company}`,
  executive: (company, service) => `${service}: accelerating outcomes for ${company}`,
};

const TONE_CLOSINGS: Record<PitchTone, string> = {
  casual: 'Cheers,\n[Your Name]',
  professional: 'Best regards,\n[Your Name]',
  executive: 'Respectfully,\n[Your Name]',
};

function extractCurrentServices(tags: string[]): string[] {
  const cleaned: string[] = [];
  for (const raw of tags ?? []) {
    const lower = raw.toLowerCase();
    if (lower.startsWith('service:') || lower.startsWith('plan:') || lower.startsWith('package:')) {
      cleaned.push(raw.split(':').slice(1).join(':').trim() || raw.trim());
    }
  }
  return Array.from(new Set(cleaned)).filter(Boolean);
}

function findPlay(upsellService: string): UpsellPlay | undefined {
  return UPSELL_PLAYS.find((play) => play.service.toLowerCase() === upsellService.toLowerCase());
}

function formatCurrency(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

interface DetectParams {
  userId: string;
  prospectId?: string;
  minConfidence: number;
}

export async function detectUpsellOpportunities({
  userId,
  prospectId,
  minConfidence,
}: DetectParams): Promise<UpsellDetectionResult> {
  logger.info('Detecting upsell opportunities', { userId, prospectId, minConfidence });

  const listQuery = prospectId
    ? `SELECT id, user_id, company_name, tags, status, deal_value FROM prospects WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`
    : `SELECT id, user_id, company_name, tags, status, deal_value FROM prospects WHERE user_id = $1`;

  const listParams = prospectId ? [prospectId, userId] : [userId];
  const prospects = await db.query<Prospect>(listQuery, listParams);

  if (!prospects.rows.length) {
    return {
      generatedAt: new Date().toISOString(),
      totalAnalyzed: 0,
      opportunities: [],
    };
  }

  const opportunities: UpsellOpportunity[] = [];

  for (const prospectRow of prospects.rows) {
    const activities = await db.query<{
      activity_type: string;
      activity_date: Date;
      subject: string | null;
      notes: string | null;
    }>(
      `
        SELECT activity_type, activity_date, subject, notes
        FROM activities
        WHERE prospect_id = $1
        ORDER BY activity_date DESC
        LIMIT 40
      `,
      [prospectRow.id]
    );

    if (!activities.rows.length) {
      continue;
    }

    const combinedNotes = activities.rows.map((row) => `${row.subject ?? ''} ${row.notes ?? ''}`.trim().toLowerCase());
    const lastRelevantActivity = activities.rows[0];
    const lastRelevantDate = lastRelevantActivity ? new Date(lastRelevantActivity.activity_date) : null;

    for (const play of UPSELL_PLAYS) {
      let mentionCount = 0;
      let freshestMentionTs: number | null = null;

      combinedNotes.forEach((note, index) => {
        if (play.keywords.some((keyword) => note.includes(keyword))) {
          mentionCount += 1;
          const activityDate = new Date(activities.rows[index].activity_date);
          const activityTs = activityDate.getTime();
          if (!freshestMentionTs || activityTs > freshestMentionTs) {
            freshestMentionTs = activityTs;
          }
        }
      });

      if (mentionCount === 0) {
        continue;
      }

      let confidence = 0.55 + Math.min(0.25, (mentionCount - 1) * 0.08);

      if (freshestMentionTs !== null && Date.now() - freshestMentionTs <= 30 * DAY_MS) {
        confidence += 0.1;
      }

      if (['negotiating', 'proposal_sent', 'qualified'].includes(String(prospectRow.status))) {
        confidence += 0.05;
      }

      if (prospectRow.deal_value && Number(prospectRow.deal_value) >= 10000) {
        confidence += 0.03;
      }

      if (confidence < minConfidence) {
        continue;
      }

      confidence = Math.min(0.95, Number(confidence.toFixed(2)));

      const reasoningParts: string[] = [`${mentionCount} mention${mentionCount === 1 ? '' : 's'} of ${play.focusArea}`];
      if (freshestMentionTs !== null) {
        const daysAgo = Math.floor((Date.now() - freshestMentionTs) / DAY_MS);
        reasoningParts.push(daysAgo === 0 ? 'Latest mention was today' : `Latest mention ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`);
      }
      if (prospectRow.status) {
        reasoningParts.push(`Current stage: ${prospectRow.status}`);
      }

      const reasoning = reasoningParts.join(' • ');
      const currentServices = extractCurrentServices(prospectRow.tags || []);

      const upsert = await db.queryOne<{
        id: string;
        status: 'detected' | 'pitched' | 'accepted' | 'declined';
        created_at: Date;
        updated_at: Date;
      }>(
        `
          INSERT INTO upsell_opportunities (
            user_id, prospect_id, suggested_service, confidence, reasoning, estimated_value, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'detected', NOW(), NOW())
          ON CONFLICT (prospect_id, suggested_service)
          DO UPDATE SET
            confidence = EXCLUDED.confidence,
            reasoning = EXCLUDED.reasoning,
            estimated_value = EXCLUDED.estimated_value,
            status = CASE
              WHEN upsell_opportunities.status IN ('accepted', 'declined') THEN upsell_opportunities.status
              ELSE 'detected'
            END,
            updated_at = NOW()
          RETURNING id, status, created_at, updated_at
        `,
        [userId, prospectRow.id, play.service, confidence, reasoning, play.estimatedValue]
      );

      const opportunity: UpsellOpportunity = {
        opportunityId: upsert?.id ?? randomUUID(),
        prospectId: prospectRow.id,
        clientName: prospectRow.company_name,
        currentServices,
        suggestedUpsell: play.service,
        confidence,
        reasoning,
        estimatedValue: play.estimatedValue,
        status: upsert?.status ?? 'detected',
        lastActivityAt:
          freshestMentionTs !== null
            ? new Date(freshestMentionTs).toISOString()
            : lastRelevantDate?.toISOString() ?? null,
        detectedAt: (upsert?.updated_at ?? new Date()).toISOString(),
      };

      opportunities.push(opportunity);
    }
  }

  const sorted = opportunities.sort((a, b) => b.confidence - a.confidence);

  return {
    generatedAt: new Date().toISOString(),
    totalAnalyzed: prospects.rows.length,
    opportunities: sorted,
  };
}

interface GeneratePitchParams {
  prospectId: string;
  upsellService: string;
  tone: PitchTone;
}

export async function generateUpsellPitch({
  prospectId,
  upsellService,
  tone,
}: GeneratePitchParams): Promise<UpsellPitchResult> {
  logger.info('Generating upsell pitch', { prospectId, upsellService, tone });

  const prospect = await db.queryOne<{
    id: string;
    company_name: string;
    user_id: string | null;
    tags: string[] | null;
    status: string | null;
    deal_value: number | null;
    last_contacted_at: Date | null;
  }>(
    `
      SELECT id, company_name, user_id, tags, status, deal_value, last_contacted_at
      FROM prospects
      WHERE id = $1
    `,
    [prospectId]
  );

  if (!prospect) {
    throw new Error('Prospect not found');
  }

  const play = findPlay(upsellService);
  if (!play) {
    throw new Error(`Unsupported upsell service: ${upsellService}`);
  }

  const contact = await db.queryOne<{
    full_name: string;
    email: string | null;
  }>(
    `
      SELECT full_name, email
      FROM contacts
      WHERE prospect_id = $1
      ORDER BY is_primary DESC, created_at ASC
      LIMIT 1
    `,
    [prospectId]
  );

  const latestActivity = await db.queryOne<{
    activity_type: string;
    activity_date: Date;
    notes: string | null;
    subject: string | null;
  }>(
    `
      SELECT activity_type, activity_date, notes, subject
      FROM activities
      WHERE prospect_id = $1
      ORDER BY activity_date DESC
      LIMIT 1
    `,
    [prospectId]
  );

  const greeting = contact ? `Hi ${contact.full_name.split(' ')[0]},` : `Hello ${prospect.company_name} team,`;

  const lastTouch = latestActivity
    ? `${latestActivity.activity_type} on ${new Date(latestActivity.activity_date).toLocaleDateString()}`
    : 'recent work together';

  const existingServices = extractCurrentServices(prospect.tags ?? []);
  const currencyBudget = formatCurrency(play.estimatedValue);

  const talkingPoints = [
    existingServices.length
      ? `Extend our ${existingServices.join(', ')} work into ${play.focusArea}`
      : `Build on our momentum to add ${play.focusArea}`,
    ...play.defaultTalkingPoints,
  ].slice(0, 4);

  const subject = TONE_SUBJECTS[tone](prospect.company_name, play.service);

  const bodyLines: string[] = [
    greeting,
    '',
    `I was reviewing our ${lastTouch} and saw a clear way to deepen the results we're already delivering.`,
    '',
    `Adding **${play.service}** would give us leverage around ${play.focusArea} so wins compound faster.`,
    '',
    'Here is what the expanded support would include:',
    '',
  ];

  talkingPoints.forEach((point) => {
    bodyLines.push(`- ${point}`);
  });

  bodyLines.push('', 'If that sounds helpful, I can share a detailed outline or jump on a quick call to scope next steps.');

  if (currencyBudget) {
    bodyLines.push(`Projected investment: ${currencyBudget} per month (flexible based on rollout speed).`);
  }

  bodyLines.push('', TONE_CLOSINGS[tone]);

  const pitchId = randomUUID();

  const existingOpportunity = await db.queryOne<{
    id: string;
    user_id: string;
    status: 'detected' | 'pitched' | 'accepted' | 'declined';
    confidence: number | null;
    estimated_value: number | null;
  }>(
    `
      SELECT id, user_id, status, confidence, estimated_value
      FROM upsell_opportunities
      WHERE prospect_id = $1 AND lower(suggested_service) = lower($2)
    `,
    [prospectId, upsellService]
  );

  const userId = existingOpportunity?.user_id ?? prospect.user_id;

  if (!userId) {
    throw new Error('Upsell opportunity missing user ownership. Set prospect.user_id or detect opportunities first.');
  }

  const confidence = existingOpportunity?.confidence ?? 0.78;
  const estimatedValue = existingOpportunity?.estimated_value ?? play.estimatedValue;

  await db.query(
    `
      INSERT INTO upsell_opportunities (
        user_id, prospect_id, suggested_service, confidence, reasoning, estimated_value, status, pitched_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pitched', NOW(), NOW())
      ON CONFLICT (prospect_id, suggested_service)
      DO UPDATE SET
        confidence = COALESCE(EXCLUDED.confidence, upsell_opportunities.confidence),
        reasoning = EXCLUDED.reasoning,
        estimated_value = COALESCE(EXCLUDED.estimated_value, upsell_opportunities.estimated_value),
        status = CASE
          WHEN upsell_opportunities.status IN ('accepted', 'declined') THEN upsell_opportunities.status
          ELSE 'pitched'
        END,
        pitched_at = NOW(),
        updated_at = NOW()
    `,
    [
      userId,
      prospectId,
      play.service,
      confidence,
      `Pitch generated ${new Date().toISOString()} - ${tone} tone`,
      estimatedValue,
    ]
  );

  const result: UpsellPitchResult = {
    pitchId,
    prospectId,
    clientName: prospect.company_name,
    tone,
    subject,
    emailBody: bodyLines.join('\n'),
    talkingPoints,
    suggestedNextSteps: [
      'Send the pitch and log responses in LeadTracker Pro',
      'Schedule a follow-up call within 3 business days if no reply',
      'Update opportunity status after client feedback',
    ],
    generatedAt: new Date().toISOString(),
  };

  logger.info('Upsell pitch generated', {
    prospectId,
    upsellService: play.service,
    tone,
  });

  return result;
}
