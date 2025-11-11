import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  ContractGenerateInputSchema,
  ContractSendInputSchema,
  ContractStatusInputSchema,
} from '../types/tools.js';
import { contractService } from '../services/contract-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const contractGenerateTool: Tool = {
  name: 'contract_generate',
  description: 'Create a contract record from an accepted proposal.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier (optional).' },
      proposalId: { type: 'string', description: 'Source proposal identifier.' },
      contractNumber: { type: 'string', description: 'Custom contract number.' },
      body: { type: 'string', description: 'Override contract body markdown.' },
      signatureDeadline: { type: 'string', description: 'Signature due date (YYYY-MM-DD).' },
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['role', 'fullName', 'email'],
        },
      },
      envelopeMetadata: { type: 'object', description: 'Metadata for e-sign providers.' },
    },
    required: ['proposalId'],
  },
};

export const contractSendTool: Tool = {
  name: 'contract_send',
  description: 'Send a contract for signature and log the event.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier.' },
      signatureUrl: { type: 'string', description: 'Hosted signing URL.' },
      deadline: { type: 'string', description: 'Signature deadline (YYYY-MM-DD).' },
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['role', 'fullName', 'email'],
        },
      },
    },
    required: ['contractId', 'signatureUrl'],
  },
};

export const contractStatusTool: Tool = {
  name: 'contract_status',
  description: 'Retrieve contract signature progress, contacts, and history.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier.' },
      contractNumber: { type: 'string', description: 'External contract number.' },
    },
  },
};

export async function handleContractGenerate(args: unknown) {
  const started = Date.now();
  try {
    const params = ContractGenerateInputSchema.parse(args ?? {});
    const contract = await contractService.generateContract(params);
    logToolExecution('contract_generate', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, contract }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_generate failed', { error: error.message });
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

export async function handleContractSend(args: unknown) {
  const started = Date.now();
  try {
    const params = ContractSendInputSchema.parse(args ?? {});
    const contract = await contractService.sendContract(params);
    logToolExecution('contract_send', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, contract }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_send failed', { error: error.message });
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

export async function handleContractStatus(args: unknown) {
  const started = Date.now();
  try {
    const params = ContractStatusInputSchema.parse(args ?? {});
    const contract = params.contractId
      ? await contractService.getContractById(params.contractId)
      : params.contractNumber
        ? await contractService.getContractByNumber(params.contractNumber)
        : null;

    if (!contract) {
      throw new Error('Contract not found.');
    }

    logToolExecution('contract_status', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, contract }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_status failed', { error: error.message });
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
