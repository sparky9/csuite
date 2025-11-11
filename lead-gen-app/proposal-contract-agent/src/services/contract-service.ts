import type { Pool, PoolClient } from 'pg';
import { getDbPool, withTransaction } from '../db/client.js';
import { proposalService } from './proposal-service.js';
import type { Contract, Proposal, SignatureContact, SignatureEvent } from '../types/entities.js';
import { generateContractNumber } from '../utils/ids.js';

interface ContractGeneratePayload {
  userId?: string;
  proposalId: string;
  contractNumber?: string;
  body?: string;
  signatureDeadline?: string;
  contacts?: Array<{ role: string; fullName: string; email: string }>;
  envelopeMetadata?: Record<string, unknown>;
}

interface ContractSendPayload {
  contractId: string;
  signatureUrl: string;
  deadline?: string;
  contacts?: Array<{ role: string; fullName: string; email: string }>;
}

interface ReminderContactSummary {
  role: string;
  fullName: string;
  email: string;
  signedAt: string | null;
}

function parseDate(value: any): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function mapContacts(rows: any[]): SignatureContact[] {
  return rows.map((row) => ({
    id: row.id,
    contractId: row.contract_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    signedAt: row.signed_at ? new Date(row.signed_at).toISOString() : null,
    reminderCount: Number(row.reminder_count ?? 0),
    createdAt: parseDate(row.created_at) ?? new Date().toISOString(),
    updatedAt: parseDate(row.updated_at) ?? new Date().toISOString(),
  }));
}

function mapEvents(rows: any[]): SignatureEvent[] {
  return rows.map((row) => ({
    id: row.id,
    contractId: row.contract_id,
    eventType: row.event_type,
    description: row.description ?? null,
    payload: row.payload ?? null,
    createdAt: parseDate(row.created_at) ?? new Date().toISOString(),
  }));
}

function mapContractRow(row: any, contacts: SignatureContact[], events: SignatureEvent[]): Contract {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    proposalId: row.proposal_id ?? null,
    contractNumber: row.contract_number,
    status: row.status,
    signatureDeadline: row.signature_deadline ? new Date(row.signature_deadline).toISOString().split('T')[0] : null,
    body: row.body,
    envelopeMetadata: row.envelope_metadata ?? {},
    sentAt: parseDate(row.sent_at),
    signedAt: parseDate(row.signed_at),
    countersignedAt: parseDate(row.countersigned_at),
    declinedAt: parseDate(row.declined_at),
    createdAt: parseDate(row.created_at) ?? new Date().toISOString(),
    updatedAt: parseDate(row.updated_at) ?? new Date().toISOString(),
    contacts,
    events,
  };
}

function buildDefaultContractBody(proposal: Proposal): string {
  const lines = proposal.lineItems.map((item) => `| ${item.description} | ${item.quantity} | ${item.unitPrice.toFixed(2)} | ${item.subtotal.toFixed(2)} |`).join('\n');
  const table = proposal.lineItems.length > 0
    ? `| Description | Qty | Rate | Subtotal |\n|-------------|-----|------|----------|\n${lines}`
    : 'No detailed line items were provided.';

  const totals = [
    proposal.subtotal !== null ? `Subtotal: ${proposal.subtotal?.toFixed(2)} ${proposal.currency}` : null,
    proposal.discount !== null ? `Discount: ${proposal.discount?.toFixed(2)} ${proposal.currency}` : null,
    proposal.tax !== null ? `Tax: ${proposal.tax?.toFixed(2)} ${proposal.currency}` : null,
    proposal.total !== null ? `Contract Total: ${proposal.total?.toFixed(2)} ${proposal.currency}` : null,
  ].filter(Boolean).join('\n');

  return `# Services Agreement\n\n**Client:** ${proposal.clientName}${proposal.clientCompany ? ` (${proposal.clientCompany})` : ''}\n\n**Prepared By:** Proposal ${proposal.proposalNumber}\n\n${proposal.summary ?? 'This contract follows the accepted proposal details and outlines the agreed scope, deliverables, and commercial terms.'}\n\n## Statement of Work\n${proposal.body}\n\n## Investment\n${table}\n\n${totals}\n\n## Terms\n- Work commences upon acceptance of this agreement.\n- Payments follow the schedule described above.\n- Any changes require a signed change order.\n\n**Signature**\n\nAuthorized representative: ____________________\n\nClient representative: ____________________\n`;
}

async function fetchContractById(contractId: string, executor?: Pool | PoolClient): Promise<Contract | null> {
  const db = executor ?? getDbPool();

  const contractResult = await db.query(
    `SELECT
       id,
       user_id,
       proposal_id,
       contract_number,
       status,
       signature_deadline,
       body,
       envelope_metadata,
       sent_at,
       signed_at,
       countersigned_at,
       declined_at,
       created_at,
       updated_at
     FROM contracts
     WHERE id = $1
     LIMIT 1`,
    [contractId]
  );

  const contractRow = contractResult.rows[0];
  if (!contractRow) {
    return null;
  }

  const contactsResult = await db.query(
    `SELECT id, contract_id, role, full_name, email, signed_at, reminder_count, created_at, updated_at
     FROM signature_contacts
     WHERE contract_id = $1
     ORDER BY role ASC`,
    [contractId]
  );

  const eventsResult = await db.query(
    `SELECT id, contract_id, event_type, description, payload, created_at
     FROM signature_events
     WHERE contract_id = $1
     ORDER BY created_at ASC`,
    [contractId]
  );

  return mapContractRow(contractRow, mapContacts(contactsResult.rows), mapEvents(eventsResult.rows));
}

async function fetchContractByNumber(contractNumber: string, executor?: Pool | PoolClient): Promise<Contract | null> {
  const db = executor ?? getDbPool();
  const contractResult = await db.query(
    `SELECT
       id,
       user_id,
       proposal_id,
       contract_number,
       status,
       signature_deadline,
       body,
       envelope_metadata,
       sent_at,
       signed_at,
       countersigned_at,
       declined_at,
       created_at,
       updated_at
     FROM contracts
     WHERE contract_number = $1
     LIMIT 1`,
    [contractNumber]
  );

  const contractRow = contractResult.rows[0];
  if (!contractRow) {
    return null;
  }

  return fetchContractById(contractRow.id, db);
}

export class ContractService {
  async generateContract(payload: ContractGeneratePayload): Promise<Contract> {
    const proposal = await proposalService.getProposalById(payload.proposalId);
    if (!proposal) {
      throw new Error('Proposal not found. Cannot generate contract.');
    }

    const contractNumber = payload.contractNumber ?? generateContractNumber();
    const body = payload.body ?? buildDefaultContractBody(proposal);
    const deadline = payload.signatureDeadline ? new Date(payload.signatureDeadline) : null;
    const contacts = payload.contacts ?? [];

    const contract = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO contracts (
           user_id,
           proposal_id,
           contract_number,
           status,
           signature_deadline,
           body,
           envelope_metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          payload.userId ?? null,
          proposal.id,
          contractNumber,
          'draft',
          deadline,
          body,
          JSON.stringify(payload.envelopeMetadata ?? {}),
        ]
      );

      const contractId = inserted.rows[0].id as string;

      if (contacts.length > 0) {
        await Promise.all(
          contacts.map((contact) =>
            client.query(
              `INSERT INTO signature_contacts (contract_id, role, full_name, email)
               VALUES ($1, $2, $3, $4)`,
              [contractId, contact.role, contact.fullName, contact.email]
            )
          )
        );
      }

      await client.query(
        `INSERT INTO signature_events (contract_id, event_type, description, payload)
         VALUES ($1, $2, $3, jsonb_build_object('proposal_id', $4::text, 'contract_number', $5::text))`,
        [contractId, 'generated', 'Contract generated from proposal', proposal.id, contractNumber]
      );

      return fetchContractById(contractId, client) as Promise<Contract>;
    });

    return contract;
  }

  async sendContract(payload: ContractSendPayload): Promise<Contract> {
    const contract = await withTransaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE contracts
         SET
           status = 'sent',
           sent_at = NOW(),
           updated_at = NOW(),
           signature_deadline = COALESCE($2::date, signature_deadline),
           envelope_metadata = COALESCE(envelope_metadata, '{}'::jsonb) || jsonb_build_object('signature_url', $3::text)
         WHERE id = $1
         RETURNING id`,
        [payload.contractId, payload.deadline ?? null, payload.signatureUrl]
      );

      if (updateResult.rowCount === 0) {
        throw new Error('Contract not found.');
      }

      if (payload.contacts && payload.contacts.length > 0) {
        await client.query('DELETE FROM signature_contacts WHERE contract_id = $1', [payload.contractId]);
        await Promise.all(
          payload.contacts.map((contact) =>
            client.query(
              `INSERT INTO signature_contacts (contract_id, role, full_name, email)
               VALUES ($1, $2, $3, $4)`,
              [payload.contractId, contact.role, contact.fullName, contact.email]
            )
          )
        );
      }

      await client.query(
        `INSERT INTO signature_events (contract_id, event_type, description, payload)
         VALUES ($1, 'sent', 'Contract sent for signature', jsonb_build_object('signature_url', $2::text))`,
        [payload.contractId, payload.signatureUrl]
      );

      return fetchContractById(payload.contractId, client) as Promise<Contract>;
    });

    return contract;
  }

  async getContractById(contractId: string): Promise<Contract | null> {
    return fetchContractById(contractId);
  }

  async getContractByNumber(contractNumber: string): Promise<Contract | null> {
    return fetchContractByNumber(contractNumber);
  }

  summarizeContacts(contacts: SignatureContact[]): ReminderContactSummary[] {
    return contacts.map((contact) => ({
      role: contact.role,
      fullName: contact.fullName,
      email: contact.email,
      signedAt: contact.signedAt,
    }));
  }
}

export const contractService = new ContractService();
