import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  ProposalGenerateInputSchema,
  ProposalSendInputSchema,
  ProposalStatusInputSchema,
} from '../types/tools.js';
import { proposalService } from '../services/proposal-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const proposalGenerateTool: Tool = {
  name: 'proposal_generate',
  description: 'Generate a proposal from a template with client specifics and pricing.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier (optional).' },
      templateId: { type: 'string', description: 'Template identifier.' },
      templateName: { type: 'string', description: 'Template name (case-insensitive).' },
      proposalNumber: { type: 'string', description: 'Override proposal number.' },
      client: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name'],
      },
      summary: { type: 'string', description: 'Executive summary for the proposal.' },
      variables: { type: 'object', description: 'Additional {{token}} variables.' },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
          },
          required: ['description'],
        },
      },
      discount: { type: 'number', description: 'Discount amount.' },
      tax: { type: 'number', description: 'Tax amount.' },
      currency: { type: 'string', description: 'ISO currency code.' },
      status: { type: 'string', description: 'Initial status (defaults to draft).' },
    },
    required: ['client'],
  },
};

export const proposalSendTool: Tool = {
  name: 'proposal_send',
  description: 'Mark a proposal as sent and log the event.',
  inputSchema: {
    type: 'object',
    properties: {
      proposalId: { type: 'string', description: 'Proposal identifier.' },
      note: { type: 'string', description: 'Internal note about this send.' },
    },
    required: ['proposalId'],
  },
};

export const proposalStatusTool: Tool = {
  name: 'proposal_status',
  description: 'Look up proposal state, totals, and line items.',
  inputSchema: {
    type: 'object',
    properties: {
      proposalId: { type: 'string', description: 'Proposal identifier.' },
      proposalNumber: { type: 'string', description: 'External proposal number.' },
    },
  },
};

export async function handleProposalGenerate(args: unknown) {
  const started = Date.now();
  try {
    const params = ProposalGenerateInputSchema.parse(args ?? {});
    const proposal = await proposalService.generateProposal(params);
    logToolExecution('proposal_generate', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, proposal }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('proposal_generate failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

export async function handleProposalSend(args: unknown) {
  const started = Date.now();
  try {
    const params = ProposalSendInputSchema.parse(args ?? {});
    const proposal = await proposalService.markProposalSent(params.proposalId, params.note);
    logToolExecution('proposal_send', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, proposal }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('proposal_send failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

export async function handleProposalStatus(args: unknown) {
  const started = Date.now();
  try {
    const params = ProposalStatusInputSchema.parse(args ?? {});
    const proposal = params.proposalId
      ? await proposalService.getProposalById(params.proposalId)
      : params.proposalNumber
        ? await proposalService.getProposalByNumber(params.proposalNumber)
        : null;

    if (!proposal) {
      throw new Error('Proposal not found.');
    }

    logToolExecution('proposal_status', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, proposal }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('proposal_status failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
