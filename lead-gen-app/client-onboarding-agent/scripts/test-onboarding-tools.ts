import { randomUUID } from 'crypto';
import { initializeOnboardingDb, shutdownOnboardingDb } from '../src/db/client.js';
import { saveTemplate, listTemplates } from '../src/services/template-service.js';
import { generatePlan, getPlanStatus, listPlans } from '../src/services/plan-service.js';
import { buildIntakeSummary } from '../src/services/intake-service.js';
import { proposeKickoffSchedule } from '../src/services/kickoff-service.js';
import { buildWelcomeSequence } from '../src/services/welcome-service.js';
import { buildProgressDigest } from '../src/services/digest-service.js';
import { buildSyncUpdate } from '../src/services/sync-service.js';
import { logger } from '../src/utils/logger.js';

async function run() {
  const smokeUserId = randomUUID();

  try {
    await initializeOnboardingDb();

    logger.info('Running onboarding smoke test', { smokeUserId });

    const templateInput = {
      userId: smokeUserId,
      template: {
        name: 'Smoke Test Template',
        description: 'Temporary test template for automated validation.',
        category: 'smoke-test',
        overview: 'Ensures onboarding pipeline works end-to-end.',
        timelineDays: 10,
        metadata: { smokeTest: true },
        stages: [
          {
            name: 'Preparation',
            description: 'Gather core info and access.',
            durationDays: 3,
            tasks: [
              {
                title: 'Send welcome packet',
                description: 'Share expectations, kickoff agenda, and secure links.',
                dueAfterDays: 0,
                assignedTo: 'account_manager',
              },
              {
                title: 'Collect access credentials',
                description: 'Ensure credentials added to vault.',
                dueAfterDays: 2,
                assignedTo: 'operations',
              },
            ],
          },
          {
            name: 'Execution',
            description: 'Deliver the first milestone.',
            durationDays: 7,
            tasks: [
              {
                title: 'Kickoff workshop',
                description: 'Run the facilitated kickoff session.',
                dueAfterDays: 4,
                assignedTo: 'delivery_lead',
              },
              {
                title: 'First deliverable outline',
                description: 'Draft outline for milestone one.',
                dueAfterDays: 6,
                assignedTo: 'delivery_lead',
              },
            ],
          },
        ],
        intakeRequirements: [
          {
            title: 'Brand questionnaire',
            instructions: 'Complete the shared intake form.',
            requestType: 'form',
            dueAfterDays: 2,
          },
          {
            title: 'Asset upload',
            instructions: 'Upload assets to the shared folder.',
            requestType: 'files',
            dueAfterDays: 4,
          },
        ],
        welcomeSequence: [
          { day: 0, channel: 'email', subject: 'Welcome aboard!', summary: 'Share kickoff checklist.' },
          { day: 3, channel: 'email', subject: 'Kickoff reminder', summary: 'Outline objectives and materials.' },
        ],
      },
    };

    const savedTemplate = await saveTemplate(templateInput);
    console.log('\nTemplate saved:', savedTemplate.name, savedTemplate.id);

  const listedTemplates = await listTemplates({ userId: smokeUserId, category: 'smoke-test' });
  console.log('Templates available:', listedTemplates.templates.length, 'of total', listedTemplates.total);

    const planResult = await generatePlan({
      userId: smokeUserId,
      templateId: savedTemplate.id!,
      client: {
        name: 'Smoke Test Client',
        company: 'Validation Labs',
        primaryContact: { name: 'Jordan QA', email: 'qa@example.com' },
      },
      owner: { name: 'Onboarding Lead', email: 'lead@example.com' },
      notes: 'Smoke Test plan',
    });

    console.log('Plan generated with steps:', planResult.steps.length);

    const status = await getPlanStatus({ planId: planResult.plan.id });
    console.log('Plan status retrieved. Intake items:', status.intake.length);

    const intakeSummary = await buildIntakeSummary({
      planId: planResult.plan.id,
      tone: 'friendly',
    });
    console.log('\nIntake summary preview:\n', intakeSummary.message.split('\n').slice(0, 5).join('\n'));

    const kickoffProposal = await proposeKickoffSchedule({
      planId: planResult.plan.id,
      teamAvailability: [
        { date: '2025-01-07', slots: ['09:00', '11:00', '14:00'] },
        { date: '2025-01-08', slots: ['10:00', '13:00'] },
      ],
      clientAvailability: [
        { date: '2025-01-08', slots: ['13:00', '16:00'] },
        { date: '2025-01-09', slots: ['09:00'] },
      ],
    });
    console.log('\nKickoff recommendations:', kickoffProposal.recommendations);

    const welcomeSequence = await buildWelcomeSequence({
      planId: planResult.plan.id,
      communicationMode: 'email',
    });
    console.log('\nWelcome touches:', welcomeSequence.touches.length);

  const digest = await buildProgressDigest({ planId: planResult.plan.id });
  console.log('\nProgress digest summary:\n', digest.digest);

  const planListing = await listPlans({ userId: smokeUserId });
  console.log('\nPlans returned from list:', planListing.plans.length, 'of total', planListing.total);

  const syncPayload = await buildSyncUpdate({ planId: planResult.plan.id, system: 'notion' });
  console.log('\nSync payload sample keys:', Object.keys(syncPayload));
  } catch (error: any) {
    logger.error('Smoke test failed', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  } finally {
    await shutdownOnboardingDb();
  }
}

run();
