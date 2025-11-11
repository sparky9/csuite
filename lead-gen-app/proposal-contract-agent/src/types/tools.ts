import { z } from 'zod';

export const TemplateListInputSchema = z.object({
  userId: z.string().uuid().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export const TemplateSaveInputSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional(),
  body: z.string().min(20),
  requiredTokens: z.array(z.string()).optional(),
  optionalTokens: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const ProposalGenerateInputSchema = z.object({
  userId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  templateName: z.string().optional(),
  proposalNumber: z.string().optional(),
  client: z.object({
    name: z.string(),
    company: z.string().optional(),
    email: z.string().email().optional(),
  }),
  summary: z.string().optional(),
  variables: z.record(z.union([z.string(), z.number()])).default({}),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().default(1),
        unitPrice: z.number().default(0),
      })
    )
    .optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
});

export const ProposalSendInputSchema = z.object({
  proposalId: z.string().uuid(),
  note: z.string().optional(),
});

export const ProposalStatusInputSchema = z.object({
  proposalId: z.string().uuid().optional(),
  proposalNumber: z.string().optional(),
}).refine((data) => data.proposalId || data.proposalNumber, {
  message: 'Provide proposalId or proposalNumber',
});

export const ContractGenerateInputSchema = z.object({
  userId: z.string().uuid().optional(),
  proposalId: z.string().uuid(),
  contractNumber: z.string().optional(),
  body: z.string().optional(),
  signatureDeadline: z.string().optional(),
  contacts: z
    .array(
      z.object({
        role: z.string(),
        fullName: z.string(),
        email: z.string().email(),
      })
    )
    .default([]),
  envelopeMetadata: z.record(z.any()).optional(),
});

export const ContractSendInputSchema = z.object({
  contractId: z.string().uuid(),
  signatureUrl: z.string().url(),
  deadline: z.string().optional(),
  contacts: z
    .array(
      z.object({
        role: z.string(),
        fullName: z.string(),
        email: z.string().email(),
      })
    )
    .optional(),
});

export const ContractStatusInputSchema = z.object({
  contractId: z.string().uuid().optional(),
  contractNumber: z.string().optional(),
}).refine((data) => data.contractId || data.contractNumber, {
  message: 'Provide contractId or contractNumber',
});

export const SignatureRemindInputSchema = z.object({
  contractId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  reminderType: z.enum(['first', 'second', 'final']).optional(),
  tone: z.enum(['professional', 'friendly', 'firm']).optional(),
});

export type TemplateListInput = z.infer<typeof TemplateListInputSchema>;
export type TemplateSaveInput = z.infer<typeof TemplateSaveInputSchema>;
export type ProposalGenerateInput = z.infer<typeof ProposalGenerateInputSchema>;
export type ProposalSendInput = z.infer<typeof ProposalSendInputSchema>;
export type ProposalStatusInput = z.infer<typeof ProposalStatusInputSchema>;
export type ContractGenerateInput = z.infer<typeof ContractGenerateInputSchema>;
export type ContractSendInput = z.infer<typeof ContractSendInputSchema>;
export type ContractStatusInput = z.infer<typeof ContractStatusInputSchema>;
export type SignatureRemindInput = z.infer<typeof SignatureRemindInputSchema>;
