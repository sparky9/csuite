import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  templateListTool,
  templateSaveTool,
  handleTemplateList,
  handleTemplateSave,
} from './template-tools.js';
import {
  proposalGenerateTool,
  proposalSendTool,
  proposalStatusTool,
  handleProposalGenerate,
  handleProposalSend,
  handleProposalStatus,
} from './proposal-tools.js';
import {
  contractGenerateTool,
  contractSendTool,
  contractStatusTool,
  handleContractGenerate,
  handleContractSend,
  handleContractStatus,
} from './contract-tools.js';
import { signatureRemindTool, handleSignatureRemind } from './reminder-tools.js';
import {
  contractGeneratePdfTool,
  contractGetSigningLinkTool,
  contractCheckSignatureStatusTool,
  contractCaptureSignatureTool,
  contractDownloadSignedPdfTool,
  contractEmbedSignatureTool,
  handleContractGeneratePdf,
  handleContractGetSigningLink,
  handleContractCheckSignatureStatus,
  handleContractCaptureSignature,
  handleContractDownloadSignedPdf,
  handleContractEmbedSignature,
} from './esignature-tools.js';

export const ALL_PROPOSAL_CONTRACT_TOOLS: Tool[] = [
  templateListTool,
  templateSaveTool,
  proposalGenerateTool,
  proposalSendTool,
  proposalStatusTool,
  contractGenerateTool,
  contractSendTool,
  contractStatusTool,
  signatureRemindTool,
  contractGeneratePdfTool,
  contractGetSigningLinkTool,
  contractCheckSignatureStatusTool,
  contractCaptureSignatureTool,
  contractDownloadSignedPdfTool,
  contractEmbedSignatureTool,
];

export const TOOL_HANDLERS: Record<string, (args: unknown) => Promise<any>> = {
  template_list: handleTemplateList,
  template_save: handleTemplateSave,
  proposal_generate: handleProposalGenerate,
  proposal_send: handleProposalSend,
  proposal_status: handleProposalStatus,
  contract_generate: handleContractGenerate,
  contract_send: handleContractSend,
  contract_status: handleContractStatus,
  signature_remind: handleSignatureRemind,
  contract_generate_pdf: handleContractGeneratePdf,
  contract_get_signing_link: handleContractGetSigningLink,
  contract_check_signature_status: handleContractCheckSignatureStatus,
  contract_capture_signature: handleContractCaptureSignature,
  contract_download_signed_pdf: handleContractDownloadSignedPdf,
  contract_embed_signature: handleContractEmbedSignature,
};
