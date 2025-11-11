import { z } from 'zod';

const widgetSlugRegex = /^[a-z0-9-]{3,64}$/;

export const WidgetDashboardTileSchema = z.object({
  component: z.string().min(1),
  size: z
    .tuple([z.number().int().positive().max(6), z.number().int().positive().max(6)])
    .optional(),
  props: z.record(z.unknown()).optional(),
});

export const WidgetRegistrationSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(widgetSlugRegex, 'Slug must be lowercase alphanumeric with dashes'),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(64),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  dashboard: z
    .object({
      tile: WidgetDashboardTileSchema,
      tags: z.array(z.string().min(1)).max(10).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WidgetRegistration = z.infer<typeof WidgetRegistrationSchema>;
export type WidgetDashboardTile = z.infer<typeof WidgetDashboardTileSchema>;

export function normalizeWidgetRegistration(input: unknown): WidgetRegistration {
  return WidgetRegistrationSchema.parse(input);
}
