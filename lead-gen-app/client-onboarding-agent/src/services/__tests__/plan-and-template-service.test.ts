import { describe, it, expect, beforeEach, vi } from 'vitest';

const { queryMock, getPoolMock, withTransactionMock } = vi.hoisted(() => {
  const query = vi.fn();
  const pool = { query } as const;

  return {
    queryMock: query,
    getPoolMock: vi.fn(() => pool),
    withTransactionMock: vi.fn(),
  };
});

vi.mock('../../db/client.js', () => ({
  getPool: getPoolMock,
  withTransaction: withTransactionMock,
}));

const { loggerInfoMock, loggerDebugMock, loggerWarnMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: loggerInfoMock,
    debug: loggerDebugMock,
    warn: loggerWarnMock,
  },
}));

import * as templateService from '../template-service.js';
import * as planService from '../plan-service.js';

describe('Template Service', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    queryMock.mockReset();
    getPoolMock.mockClear();
    loggerDebugMock.mockReset();
    withTransactionMock.mockReset();
  });

  it('lists templates with filters and normalizes results', async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        {
          id: 'template-1',
          name: 'Kickoff Blueprint',
          description: 'Baseline onboarding template',
          category: 'onboarding',
          overview: 'Overview',
          timeline_days: 30,
          stages: [
            {
              name: 'Prep',
              tasks: [{ title: 'Collect docs', dueAfterDays: 0 }],
            },
          ],
          intake_requirements: [
            { requestType: 'document', title: 'Signed agreement', instructions: 'Upload PDF' },
          ],
          welcome_sequence: [{ day: 0, channel: 'email', subject: 'Welcome', summary: 'Intro email' }],
          metadata: { complexity: 'standard' },
          full_count: '5',
        },
        {
          id: 'template-2',
          name: 'Accelerated Plan',
          description: null,
          category: 'onboarding',
          overview: null,
          timeline_days: null,
          stages: [
            {
              name: 'Start',
              tasks: [{ title: 'Kickoff call', dueAfterDays: 1 }],
            },
          ],
          intake_requirements: [],
          welcome_sequence: [],
          metadata: null,
          full_count: '5',
        },
      ],
    });

    const result = await templateService.listTemplates({
      userId,
      category: 'onboarding',
      search: 'kick',
      limit: 5,
      offset: 10,
    });

    expect(getPoolMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY updated_at DESC'),
      [userId, 'onboarding', '%kick%', 5, 10]
    );

    expect(result).toEqual({
      total: 5,
      limit: 5,
      offset: 10,
      templates: [
        {
          id: 'template-1',
          name: 'Kickoff Blueprint',
          description: 'Baseline onboarding template',
          category: 'onboarding',
          overview: 'Overview',
          timelineDays: 30,
          stages: [
            {
              name: 'Prep',
              tasks: [{ title: 'Collect docs', dueAfterDays: 0 }],
            },
          ],
          intakeRequirements: [
            { requestType: 'document', title: 'Signed agreement', instructions: 'Upload PDF' },
          ],
          welcomeSequence: [{ day: 0, channel: 'email', subject: 'Welcome', summary: 'Intro email' }],
          metadata: { complexity: 'standard' },
        },
        {
          id: 'template-2',
          name: 'Accelerated Plan',
          description: undefined,
          category: 'onboarding',
          overview: undefined,
          timelineDays: undefined,
          stages: [
            {
              name: 'Start',
              tasks: [{ title: 'Kickoff call', dueAfterDays: 1 }],
            },
          ],
          intakeRequirements: [],
          welcomeSequence: [],
          metadata: {},
        },
      ],
    });

    expect(loggerDebugMock).toHaveBeenCalledWith('Listed onboarding templates', {
      userId,
      category: 'onboarding',
      search: 'kick',
      returned: 2,
      total: 5,
      limit: 5,
      offset: 10,
    });
  });

  it('updates an existing template inside a transaction', async () => {
    const clientQueryMock = vi.fn();
    const mockClient = { query: clientQueryMock } as any;
    withTransactionMock.mockImplementation(async (handler: any) => handler(mockClient));

    const input = {
      userId,
      template: {
  id: '11111111-aaaa-bbbb-cccc-111111111111',
        name: 'Existing Template',
        stages: [
          {
            name: 'Stage 1',
            tasks: [{ title: 'Task', description: 'Desc', dueAfterDays: 0 }],
          },
        ],
      },
    };

    clientQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: '11111111-aaaa-bbbb-cccc-111111111111',
          name: 'Existing Template',
          description: null,
          category: null,
          overview: null,
          timeline_days: null,
          stages: input.template.stages,
          intake_requirements: [],
          welcome_sequence: [],
          metadata: {},
        },
      ],
    });

    const result = await templateService.saveTemplate(input);

    expect(withTransactionMock).toHaveBeenCalledTimes(1);
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE onboarding_templates'),
      expect.arrayContaining(['11111111-aaaa-bbbb-cccc-111111111111', 'Existing Template'])
    );
    expect(result).toMatchObject({ id: '11111111-aaaa-bbbb-cccc-111111111111', name: 'Existing Template' });
    expect(loggerDebugMock).toHaveBeenCalledWith('Saving onboarding template', {
      userId,
      templateName: 'Existing Template',
    });
  });

  it('inserts a new template when no existing record is found', async () => {
    const clientQueryMock = vi.fn();
    const mockClient = { query: clientQueryMock } as any;
    withTransactionMock.mockImplementation(async (handler: any) => handler(mockClient));

    const input = {
      userId,
      template: {
        name: 'New Template',
        description: 'Fresh',
        category: 'onboarding',
        stages: [
          {
            name: 'Stage 1',
            tasks: [{ title: 'Task', description: 'Desc', dueAfterDays: 0 }],
          },
        ],
        intakeRequirements: [],
        welcomeSequence: [],
      },
    };

    clientQueryMock.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    clientQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: '22222222-bbbb-cccc-dddd-222222222222',
          name: 'New Template',
          description: 'Fresh',
          category: 'onboarding',
          overview: null,
          timeline_days: null,
          stages: input.template.stages,
          intake_requirements: [],
          welcome_sequence: [],
          metadata: {},
        },
      ],
    });

    const result = await templateService.saveTemplate(input);

    expect(clientQueryMock).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT id FROM onboarding_templates'), [
      userId,
      'New Template',
    ]);
    expect(clientQueryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO onboarding_templates'), expect.any(Array));
  expect(result).toMatchObject({ id: '22222222-bbbb-cccc-dddd-222222222222', name: 'New Template', description: 'Fresh' });
    expect(loggerDebugMock).toHaveBeenCalledWith('Saving onboarding template', {
      userId,
      templateName: 'New Template',
    });
  });
});

describe('Plan Service', () => {
  const userId = '22222222-2222-2222-2222-222222222222';
  const planId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    queryMock.mockReset();
    getPoolMock.mockClear();
    loggerInfoMock.mockReset();
    loggerDebugMock.mockReset();
    loggerWarnMock.mockReset();
    withTransactionMock.mockReset();
  });

  it('lists plans with status and search filters', async () => {
    const countResult = { rows: [{ count: '3' }], rowCount: 1 };
    const dataResult = {
      rows: [
        {
          id: planId,
          template_id: 'template-9',
          client_name: 'Acme Corp',
          client_company: 'Acme',
          owner_name: 'Jordan',
          status: 'in_progress',
          progress: 35,
          kickoff_target: null,
          step_count: 6,
          completed_steps: 2,
          outstanding_intake: 1,
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T10:00:00Z'),
        },
      ],
      rowCount: 1,
    };

    queryMock.mockResolvedValueOnce(countResult);
    queryMock.mockResolvedValueOnce(dataResult);

    const result = await planService.listPlans({
      userId,
      status: ['in_progress'],
      search: 'Acme',
      limit: 10,
      offset: 5,
    });

    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT COUNT(*) FROM onboarding_plans'),
      [userId, ['in_progress'], '%Acme%']
    );

    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SELECT p.*'),
      [userId, ['in_progress'], '%Acme%', 10, 5]
    );

    expect(result).toEqual({
      total: 3,
      limit: 10,
      offset: 5,
      plans: [
        {
          id: planId,
          templateId: 'template-9',
          clientName: 'Acme Corp',
          clientCompany: 'Acme',
          ownerName: 'Jordan',
          status: 'in_progress',
          progress: 35,
          kickoffTarget: undefined,
          stepCount: 6,
          completedSteps: 2,
          outstandingIntake: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-02T10:00:00Z'),
        },
      ],
    });

    expect(loggerDebugMock).toHaveBeenCalledWith('Listed onboarding plans', {
      userId,
      status: ['in_progress'],
      search: 'Acme',
      returned: 1,
      total: 3,
      limit: 10,
      offset: 5,
    });
  });

  it('updates stored progress when status has changed', async () => {
    const createdAt = new Date('2024-02-01T12:00:00Z');
    const updatedAt = new Date('2024-02-02T12:34:00Z');

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: planId,
          user_id: userId,
          template_id: 'template-1',
          client_name: 'Beta LLC',
          client_company: 'Beta',
          owner_name: 'Riley',
          status: 'in_progress',
          progress: 0,
          kickoff_target: null,
          summary: null,
          context: {},
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
    });

    queryMock.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        {
          id: 'step-1',
          stage_order: 1,
          step_order: 1,
          stage_name: 'Prep',
          title: 'Collect docs',
          description: null,
          due_date: '2024-02-05',
          assigned_to: null,
          status: 'completed',
          completed_at: '2024-02-02',
          blocker_note: null,
          metadata: { checklist: [] },
        },
        {
          id: 'step-2',
          stage_order: 1,
          step_order: 2,
          stage_name: 'Prep',
          title: 'Schedule kickoff',
          description: null,
          due_date: '2024-02-06',
          assigned_to: null,
          status: 'pending',
          completed_at: null,
          blocker_note: null,
          metadata: { checklist: [] },
        },
      ],
    });

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'intake-1',
          request_type: 'document',
          title: 'Signed agreement',
          instructions: 'Upload PDF',
          due_date: '2024-02-07',
          status: 'pending',
          response_data: null,
          reminder_count: 0,
          last_reminded_at: null,
        },
      ],
    });

    queryMock.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await planService.getPlanStatus({ planId });

    expect(queryMock).toHaveBeenNthCalledWith(4, expect.stringContaining('UPDATE onboarding_plans SET progress = $2'), [
      planId,
      50,
    ]);

    expect(result.plan.progress).toBe(50);
    expect(result.steps).toHaveLength(2);
    expect(result.intake).toHaveLength(1);
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('generates a plan, inserts steps and emits automation events', async () => {
    const clientQueryMock = vi.fn();
    const mockClient = { query: clientQueryMock } as any;
    withTransactionMock.mockImplementation(async (handler: any) => handler(mockClient));

    clientQueryMock.mockResolvedValue({ rowCount: 0, rows: [] });
    clientQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: '33333333-cccc-dddd-eeee-333333333333',
          stages: [
            { name: 'Prep', tasks: [{ title: 'Collect docs', dueAfterDays: 0 }] },
            { name: 'Kickoff', tasks: [{ title: 'Run kickoff', dueAfterDays: 2 }] },
          ],
          intake_requirements: [
            { requestType: 'document', title: 'Agreement', instructions: 'Upload signed contract', dueAfterDays: 1 },
          ],
        },
      ],
    });

    clientQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: planId,
          kickoff_target: null,
        },
      ],
    });

    const planRow = {
      id: planId,
      user_id: userId,
      template_id: '33333333-cccc-dddd-eeee-333333333333',
      client_name: 'Acme Corp',
      client_company: null,
      owner_name: null,
      status: 'in_progress',
      progress: 0,
      kickoff_target: null,
      summary: null,
      context: {},
      created_at: new Date('2024-03-01T09:00:00Z'),
      updated_at: new Date('2024-03-01T09:00:00Z'),
    };

    queryMock.mockResolvedValueOnce({ rowCount: 1, rows: [planRow] });
    queryMock.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        {
          id: 'step-1',
          stage_order: 1,
          step_order: 1,
          stage_name: 'Prep',
          title: 'Collect docs',
          description: null,
          due_date: '2024-03-02',
          assigned_to: null,
          status: 'pending',
          completed_at: null,
          blocker_note: null,
          metadata: { checklist: [] },
        },
        {
          id: 'step-2',
          stage_order: 2,
          step_order: 1,
          stage_name: 'Kickoff',
          title: 'Run kickoff',
          description: null,
          due_date: '2024-03-04',
          assigned_to: null,
          status: 'pending',
          completed_at: null,
          blocker_note: null,
          metadata: { checklist: [] },
        },
      ],
    });
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'intake-1',
          request_type: 'document',
          title: 'Agreement',
          instructions: 'Upload signed contract',
          due_date: '2024-03-03',
          status: 'pending',
          response_data: null,
          reminder_count: 0,
          last_reminded_at: null,
        },
      ],
    });

    const request = {
      userId,
  templateId: '33333333-cccc-dddd-eeee-333333333333',
      client: { name: 'Acme Corp' },
    };

    const result = await planService.generatePlan(request);

    expect(withTransactionMock).toHaveBeenCalledTimes(1);
    expect(clientQueryMock).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT * FROM onboarding_templates'), [
      '33333333-cccc-dddd-eeee-333333333333',
      userId,
    ]);
    expect(clientQueryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO onboarding_plans'), expect.any(Array));
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO automation_events'),
      expect.arrayContaining([planId, 'plan_generated'])
    );
    expect(queryMock).toHaveBeenNthCalledWith(1, 'SELECT * FROM onboarding_plans WHERE id = $1', [planId]);
    expect(result.plan.id).toBe(planId);
    expect(result.steps).toHaveLength(2);
    expect(result.intake).toHaveLength(1);
    expect(loggerInfoMock).toHaveBeenCalledWith('Generating onboarding plan', {
      userId,
      templateId: '33333333-cccc-dddd-eeee-333333333333',
      client: 'Acme Corp',
    });
  });
});
