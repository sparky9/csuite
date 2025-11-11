import { welcomeSequenceInputSchema, WelcomeTouch } from '../types/onboarding.js';
import { getPool } from '../db/client.js';
import { logger } from '../utils/logger.js';

const channelMap: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  both: 'Email + SMS',
};

const fallbackSequence: WelcomeTouch[] = [
  { day: 0, channel: 'email', subject: 'Welcome aboard!', summary: 'Warm welcome and onboarding expectations.' },
  { day: 2, channel: 'email', subject: 'Resource roundup', summary: 'Share knowledge base and quick-start videos.' },
  { day: 7, channel: 'email', subject: 'Week-one check-in', summary: 'Invite feedback and confirm next actions.' },
];

export const buildWelcomeSequence = async (input: unknown) => {
  const parsed = welcomeSequenceInputSchema.parse(input);
  const { planId, communicationMode } = parsed;
  const pool = getPool();

  const result = await pool.query(
    `SELECT p.client_name, p.client_company, t.welcome_sequence
       FROM onboarding_plans p
       LEFT JOIN onboarding_templates t ON t.id = p.template_id
     WHERE p.id = $1`,
    [planId]
  );

  if (result.rowCount === 0) {
    throw new Error('Plan not found for welcome sequence.');
  }

  const row = result.rows[0];
  const sequence: WelcomeTouch[] = (row.welcome_sequence && row.welcome_sequence.length)
    ? row.welcome_sequence
    : fallbackSequence;

  const normalized = sequence.map((touch) => ({
    ...touch,
    channel: communicationMode === 'both' ? `${touch.channel} + sms` : communicationMode ?? touch.channel,
  }));

  const overview = normalized
    .map((touch) => {
      const channelLabel =
        communicationMode === 'both'
          ? channelMap.both
          : channelMap[communicationMode ?? 'email'] ?? 'Email';
      return `${touch.day === 0 ? 'Day 0' : `Day ${touch.day}`} • ${channelLabel}\nSubject: ${touch.subject}\n${touch.summary}`;
    })
    .join('\n\n');

  logger.debug('Built welcome sequence', { planId, touches: normalized.length });

  return {
    planId,
    client: {
      name: row.client_name,
      company: row.client_company ?? undefined,
    },
    communicationMode,
    touches: normalized,
    overview,
  };
};
