import { kickoffScheduleInputSchema } from '../types/onboarding.js';
import { getPool } from '../db/client.js';
import { logger } from '../utils/logger.js';

const intersectSlots = (
  teamAvailability: { date: string; slots: string[] }[],
  clientAvailability: { date: string; slots: string[] }[]
) => {
  const clientMap = new Map<string, Set<string>>();
  clientAvailability.forEach(({ date, slots }) => {
    clientMap.set(date, new Set(slots));
  });

  for (const { date, slots } of teamAvailability) {
    const clientSlots = clientMap.get(date);
    if (!clientSlots) continue;

    for (const slot of slots) {
      if (clientSlots.has(slot)) {
        return { date, slot };
      }
    }
  }

  return null;
};

export const proposeKickoffSchedule = async (input: unknown) => {
  const parsed = kickoffScheduleInputSchema.parse(input);
  const { planId, teamAvailability, clientAvailability } = parsed;
  const pool = getPool();

  const planResult = await pool.query(
    'SELECT client_name, client_company, kickoff_target FROM onboarding_plans WHERE id = $1',
    [planId]
  );

  if (planResult.rowCount === 0) {
    throw new Error('Plan not found for kickoff scheduling.');
  }

  const plan = planResult.rows[0];

  const match = intersectSlots(teamAvailability, clientAvailability);

  const recommendations = [] as { date: string; slot: string }[];

  if (match) {
    recommendations.push(match);
  }

  // Provide fallbacks by pairing first two options even if no direct overlap
  if (recommendations.length < 2) {
    const topTeam = teamAvailability[0];
    const topClient = clientAvailability[0];
    if (topTeam && topTeam.slots.length) {
      recommendations.push({ date: topTeam.date, slot: topTeam.slots[0] });
    }
    if (topClient && topClient.slots.length) {
      recommendations.push({ date: topClient.date, slot: topClient.slots[0] });
    }
  }

  const deduped = recommendations.filter(
    (option, idx, arr) =>
      arr.findIndex((candidate) => candidate.date === option.date && candidate.slot === option.slot) === idx
  );

  const summaryLines = deduped
    .slice(0, 3)
    .map(
      (option, idx) =>
        `${idx + 1}. ${option.date} @ ${option.slot} (${idx === 0 ? 'best overlap' : 'alternative'})`
    )
    .join('\n');

  const kickoffTarget = plan.kickoff_target
    ? new Date(plan.kickoff_target).toISOString().slice(0, 10)
    : 'TBD';

  const narrative = `Recommended kickoff options for ${plan.client_name} (${plan.client_company ?? 'N/A'})\nTarget week: ${kickoffTarget}\n\n${summaryLines}`;

  const matched = Boolean(match);

  await pool.query(
    `INSERT INTO automation_events (plan_id, event_type, description, payload)
     VALUES ($1, 'kickoff_proposed', 'Kickoff schedule generated', $2::jsonb)`,
    [
      planId,
      JSON.stringify({
        source: 'onboarding_kickoff_schedule',
        matchFound: matched,
        recommendations: deduped,
        teamAvailabilityCount: teamAvailability.length,
        clientAvailabilityCount: clientAvailability.length,
      }),
    ]
  );

  logger.info('Generated kickoff recommendation', {
    planId,
    options: deduped.length,
    overlapFound: matched,
  });

  return {
    planId,
    kickoffTarget,
    recommendations: deduped,
    narrative,
  };
};
