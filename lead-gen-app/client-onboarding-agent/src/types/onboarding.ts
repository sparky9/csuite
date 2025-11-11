import { z } from 'zod';

export const stageTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3).optional(),
  dueAfterDays: z.number().int().nonnegative(),
  assignedTo: z.string().min(2).optional(),
  checklist: z.array(z.string()).optional(),
});

export const stageSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  durationDays: z.number().int().positive().optional(),
  tasks: z.array(stageTaskSchema).min(1),
});

export const intakeRequirementSchema = z.object({
  title: z.string().min(3),
  instructions: z.string().min(3),
  requestType: z.string().min(2),
  dueAfterDays: z.number().int().nonnegative().default(0),
  owner: z.string().optional(),
});

export const welcomeTouchSchema = z.object({
  day: z.number().int().nonnegative(),
  channel: z.string().min(2),
  subject: z.string().min(3),
  summary: z.string().min(3),
});

export const templatePayloadSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional(),
  overview: z.string().optional(),
  timelineDays: z.number().int().positive().optional(),
  stages: z.array(stageSchema).min(1),
  intakeRequirements: z.array(intakeRequirementSchema).default([]),
  welcomeSequence: z.array(welcomeTouchSchema).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const saveTemplateInputSchema = z.object({
  userId: z.string().uuid(),
  template: templatePayloadSchema,
});

export const listTemplatesInputSchema = z.object({
  userId: z.string().uuid(),
  category: z.string().optional(),
  search: z.string().min(2).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export const planClientSchema = z.object({
  name: z.string().min(3),
  company: z.string().optional(),
  primaryContact: z.object({
    name: z.string().min(3),
    email: z.string().email(),
  }).optional(),
});

export const planOwnerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email().optional(),
});

export const planGenerateInputSchema = z.object({
  userId: z.string().uuid(),
  templateId: z.string().uuid(),
  kickoffPreferences: z
    .object({
      targetDate: z.string().datetime().optional(),
      timezone: z.string().optional(),
      meetingLengthMinutes: z.number().int().positive().optional(),
    })
    .optional(),
  client: planClientSchema,
  owner: planOwnerSchema.optional(),
  notes: z.string().optional(),
});

export const planStatusInputSchema = z.object({
  planId: z.string().uuid(),
});

export const intakeSummaryInputSchema = z.object({
  planId: z.string().uuid(),
  tone: z.enum(['concise', 'friendly', 'direct']).optional().default('friendly'),
  includeCompleted: z.boolean().optional().default(false),
});

export const kickoffScheduleInputSchema = z.object({
  planId: z.string().uuid(),
  teamAvailability: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slots: z.array(z.string()),
      })
    )
    .min(1),
  clientAvailability: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slots: z.array(z.string()),
      })
    )
    .min(1),
});

export const welcomeSequenceInputSchema = z.object({
  planId: z.string().uuid(),
  communicationMode: z.enum(['email', 'sms', 'both']).optional().default('email'),
});

export const syncUpdateInputSchema = z.object({
  planId: z.string().uuid(),
  system: z.string().min(2),
});

export const progressDigestInputSchema = z.object({
  planId: z.string().uuid(),
});

export const listPlansInputSchema = z.object({
  userId: z.string().uuid(),
  status: z.array(z.string()).optional(),
  search: z.string().min(2).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export type StageTask = z.infer<typeof stageTaskSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type IntakeRequirement = z.infer<typeof intakeRequirementSchema>;
export type WelcomeTouch = z.infer<typeof welcomeTouchSchema>;
export type TemplatePayload = z.infer<typeof templatePayloadSchema>;
export type SaveTemplateInput = z.infer<typeof saveTemplateInputSchema>;
export type ListTemplatesInput = z.infer<typeof listTemplatesInputSchema>;
export type PlanGenerateInput = z.infer<typeof planGenerateInputSchema>;
export type PlanStatusInput = z.infer<typeof planStatusInputSchema>;
export type IntakeSummaryInput = z.infer<typeof intakeSummaryInputSchema>;
export type KickoffScheduleInput = z.infer<typeof kickoffScheduleInputSchema>;
export type WelcomeSequenceInput = z.infer<typeof welcomeSequenceInputSchema>;
export type SyncUpdateInput = z.infer<typeof syncUpdateInputSchema>;
export type ProgressDigestInput = z.infer<typeof progressDigestInputSchema>;
export type ListPlansInput = z.infer<typeof listPlansInputSchema>;
