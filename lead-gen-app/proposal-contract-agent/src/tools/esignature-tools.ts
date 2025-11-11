import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { pdfService } from '../services/pdf-service.js';
import { signatureService } from '../services/signature-service.js';
import { contractService } from '../services/contract-service.js';
import { proposalService } from '../services/proposal-service.js';
import { logger, logToolExecution } from '../utils/logger.js';
import { z } from 'zod';

// Input validation schemas
const GeneratePdfInputSchema = z.object({
  contractId: z.string().uuid().describe('Contract identifier'),
  includeSignatureFields: z.boolean().optional().describe('Add signature field placeholders'),
});

const GenerateSigningLinkInputSchema = z.object({
  contractId: z.string().uuid().describe('Contract identifier'),
  contactId: z.string().uuid().describe('Signature contact identifier'),
  expirationDays: z.number().optional().default(30).describe('Token expiration in days'),
});

const CheckSignatureStatusInputSchema = z.object({
  contractId: z.string().uuid().describe('Contract identifier'),
});

const CaptureSignatureInputSchema = z.object({
  token: z.string().describe('Signing token from URL'),
  signatureType: z.enum(['typed', 'drawn', 'uploaded']).describe('Type of signature capture'),
  signatureData: z.string().describe('Base64 encoded signature image or typed text'),
  signatureFormat: z.enum(['png', 'svg', 'text']).optional().describe('Format of signature data'),
  fontFamily: z.string().optional().describe('Font family for typed signatures'),
  ipAddress: z.string().optional().describe('Signer IP address'),
  userAgent: z.string().optional().describe('Signer user agent'),
});

const DownloadSignedPdfInputSchema = z.object({
  contractId: z.string().uuid().describe('Contract identifier'),
});

const EmbedSignatureInputSchema = z.object({
  contractId: z.string().uuid().describe('Contract identifier'),
  contactId: z.string().uuid().describe('Contact who signed'),
  page: z.number().optional().default(0).describe('Page number (0-indexed)'),
  x: z.number().optional().default(100).describe('X coordinate'),
  y: z.number().optional().default(150).describe('Y coordinate'),
});

// Tool definitions
export const contractGeneratePdfTool: Tool = {
  name: 'contract_generate_pdf',
  description:
    'Generate a signable PDF from a contract. Converts markdown contract body to professional PDF with optional signature fields.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier (UUID).' },
      includeSignatureFields: {
        type: 'boolean',
        description: 'Add signature field placeholders to PDF (default: true).',
      },
    },
    required: ['contractId'],
  },
};

export const contractGetSigningLinkTool: Tool = {
  name: 'contract_get_signing_link',
  description:
    'Generate a unique, secure signing link for a contract signer. Returns a time-limited URL that can be emailed to the signer.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier (UUID).' },
      contactId: { type: 'string', description: 'Signature contact identifier (UUID).' },
      expirationDays: { type: 'number', description: 'Number of days until link expires (default: 30).' },
    },
    required: ['contractId', 'contactId'],
  },
};

export const contractCheckSignatureStatusTool: Tool = {
  name: 'contract_check_signature_status',
  description:
    'Check the signature status of a contract. Returns information about all signers, who has signed, and who is pending.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier (UUID).' },
    },
    required: ['contractId'],
  },
};

export const contractCaptureSignatureTool: Tool = {
  name: 'contract_capture_signature',
  description:
    'Capture a signature from a signer using their unique token. Stores signature data and marks contact as signed.',
  inputSchema: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Signing token from URL.' },
      signatureType: {
        type: 'string',
        enum: ['typed', 'drawn', 'uploaded'],
        description: 'Type of signature capture.',
      },
      signatureData: { type: 'string', description: 'Base64 encoded signature image or typed text.' },
      signatureFormat: {
        type: 'string',
        enum: ['png', 'svg', 'text'],
        description: 'Format of signature data.',
      },
      fontFamily: { type: 'string', description: 'Font family for typed signatures (e.g., "Brush Script MT").' },
      ipAddress: { type: 'string', description: 'Signer IP address for audit trail.' },
      userAgent: { type: 'string', description: 'Signer user agent for audit trail.' },
    },
    required: ['token', 'signatureType', 'signatureData'],
  },
};

export const contractDownloadSignedPdfTool: Tool = {
  name: 'contract_download_signed_pdf',
  description:
    'Download the final signed PDF for a contract. Returns PDF data with all signatures embedded and integrity checksum.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier (UUID).' },
    },
    required: ['contractId'],
  },
};

export const contractEmbedSignatureTool: Tool = {
  name: 'contract_embed_signature',
  description:
    'Embed a captured signature into the contract PDF. This is typically done after signature capture to create the final signed document.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier (UUID).' },
      contactId: { type: 'string', description: 'Contact identifier who signed.' },
      page: { type: 'number', description: 'Page number to embed signature (0-indexed, default: last page).' },
      x: { type: 'number', description: 'X coordinate on page (default: 100).' },
      y: { type: 'number', description: 'Y coordinate on page (default: 150).' },
    },
    required: ['contractId', 'contactId'],
  },
};

// Tool handlers
export async function handleContractGeneratePdf(args: unknown) {
  const started = Date.now();
  try {
    const params = GeneratePdfInputSchema.parse(args ?? {});

    // Get contract details
    const contract = await contractService.getContractById(params.contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Get proposal for client name
    const proposal = contract.proposalId ? await proposalService.getProposalById(contract.proposalId) : null;

    // Generate PDF
    const pdfBuffer = await pdfService.generateContractPdf({
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractBody: contract.body,
  clientName: proposal?.clientName ?? contract.contacts.find((c) => c.role === 'client')?.fullName ?? 'Client',
      includeSignatureField: params.includeSignatureFields ?? true,
    });

    // Store PDF in database
    const fileName = `contract-${contract.contractNumber}.pdf`;
    const storageResult = await pdfService.storePdf(contract.id, pdfBuffer, fileName);

    logToolExecution('contract_generate_pdf', params, Date.now() - started);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              contractId: contract.id,
              contractNumber: contract.contractNumber,
              pdf: {
                documentId: storageResult.documentId,
                fileName: storageResult.fileName,
                fileSize: storageResult.fileSize,
                checksum: storageResult.checksum,
              },
              message: 'PDF generated and stored successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_generate_pdf failed', { error: error.message });
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

export async function handleContractGetSigningLink(args: unknown) {
  const started = Date.now();
  try {
    const params = GenerateSigningLinkInputSchema.parse(args ?? {});

    // Validate contract and contact exist
    const contract = await contractService.getContractById(params.contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const contact = contract.contacts.find((c) => c.id === params.contactId);
    if (!contact) {
      throw new Error('Contact not found in contract');
    }

    // Generate signing token
    const { token, signingUrl, expiresAt } = await signatureService.generateSigningToken(
      params.contractId,
      params.contactId,
      params.expirationDays
    );

    logToolExecution('contract_get_signing_link', params, Date.now() - started);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              contractId: params.contractId,
              contact: {
                id: contact.id,
                fullName: contact.fullName,
                email: contact.email,
                role: contact.role,
              },
              signing: {
                token,
                signingUrl,
                expiresAt: expiresAt.toISOString(),
                expirationDays: params.expirationDays,
              },
              message: `Signing link generated for ${contact.fullName}. Send this URL via email.`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_get_signing_link failed', { error: error.message });
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

export async function handleContractCheckSignatureStatus(args: unknown) {
  const started = Date.now();
  try {
    const params = CheckSignatureStatusInputSchema.parse(args ?? {});

    const status = await signatureService.getSignatureStatus(params.contractId);

    logToolExecution('contract_check_signature_status', params, Date.now() - started);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              ...status,
              progress: `${status.signedCount} of ${status.totalSigners} signed`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_check_signature_status failed', { error: error.message });
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

export async function handleContractCaptureSignature(args: unknown) {
  const started = Date.now();
  try {
    const params = CaptureSignatureInputSchema.parse(args ?? {});

    // Validate token
    const validation = await signatureService.validateToken(params.token, params.ipAddress, params.userAgent);

    if (!validation.valid) {
      throw new Error(`Token validation failed: ${validation.reason}`);
    }

    // Capture signature
    const { signatureId, timestamp } = await signatureService.captureSignature({
      contactId: validation.contactId!,
      signatureType: params.signatureType,
      signatureData: params.signatureData,
      signatureFormat: params.signatureFormat,
      fontFamily: params.fontFamily,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    logToolExecution('contract_capture_signature', { token: 'hidden' }, Date.now() - started);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              signatureId,
              timestamp: timestamp.toISOString(),
              message: 'Signature captured successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_capture_signature failed', { error: error.message });
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

export async function handleContractDownloadSignedPdf(args: unknown) {
  const started = Date.now();
  try {
    const params = DownloadSignedPdfInputSchema.parse(args ?? {});

    // Get PDF from database
    const pdfData = await pdfService.getPdfByContractId(params.contractId);

    if (!pdfData) {
      throw new Error('PDF not found for this contract. Generate PDF first.');
    }

    // Verify integrity
    const isValid = pdfService.verifyPdfIntegrity(pdfData.buffer, pdfData.checksum);

    if (!isValid) {
      logger.warn('PDF integrity check failed', { contractId: params.contractId });
    }

    logToolExecution('contract_download_signed_pdf', params, Date.now() - started);

    // Return base64 encoded PDF (for MCP transport)
    const base64Pdf = pdfData.buffer.toString('base64');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              contractId: params.contractId,
              fileName: pdfData.fileName,
              fileSize: pdfData.buffer.length,
              checksum: pdfData.checksum,
              integrityVerified: isValid,
              pdfBase64: base64Pdf.substring(0, 100) + '...(truncated for display)',
              message:
                'PDF retrieved successfully. Full base64 data available in pdfBase64 field (truncated in this response).',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_download_signed_pdf failed', { error: error.message });
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

export async function handleContractEmbedSignature(args: unknown) {
  const started = Date.now();
  try {
    const params = EmbedSignatureInputSchema.parse(args ?? {});

    // Get existing PDF
    const pdfData = await pdfService.getPdfByContractId(params.contractId);
    if (!pdfData) {
      throw new Error('PDF not found. Generate PDF first using contract_generate_pdf.');
    }

    // Get signature data
    const signatureData = await signatureService.getSignatureData(params.contactId);
    if (!signatureData) {
      throw new Error('Signature not found for this contact. Capture signature first.');
    }

    // Embed signature into PDF
    const signedPdfBuffer = await pdfService.embedSignature(pdfData.buffer, signatureData.signatureData, {
      page: params.page,
      x: params.x,
      y: params.y,
    });

    // Store updated PDF
    const fileName = `contract-${params.contractId}-signed.pdf`;
    const storageResult = await pdfService.storePdf(params.contractId, signedPdfBuffer, fileName);

    logToolExecution('contract_embed_signature', params, Date.now() - started);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              contractId: params.contractId,
              contactId: params.contactId,
              pdf: {
                documentId: storageResult.documentId,
                fileName: storageResult.fileName,
                fileSize: storageResult.fileSize,
                checksum: storageResult.checksum,
              },
              message: 'Signature embedded in PDF successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('contract_embed_signature failed', { error: error.message });
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
