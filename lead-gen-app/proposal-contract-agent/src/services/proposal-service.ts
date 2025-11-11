import type { Pool, PoolClient } from 'pg';
import { getDbPool, withTransaction } from '../db/client.js';
import { templateService } from './template-service.js';
import type { Proposal, ProposalLineItem, ProposalTemplate } from '../types/entities.js';
import { renderTemplate, findMissingTokens } from '../utils/template.js';
import { generateProposalNumber } from '../utils/ids.js';

interface ProposalLineItemInput {
  description: string;
  quantity?: number;
  unitPrice?: number;
}

interface ProposalGeneratePayload {
  userId?: string;
  templateId?: string;
  templateName?: string;
  proposalNumber?: string;
  client: {
    name: string;
    company?: string;
    email?: string;
  };
  summary?: string;
  variables?: Record<string, string | number>;
  lineItems?: ProposalLineItemInput[];
  discount?: number;
  tax?: number;
  currency?: string;
  status?: string;
}

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapProposalRow(row: any, lineItems: ProposalLineItem[]): Proposal {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    templateId: row.template_id ?? null,
    proposalNumber: row.proposal_number,
    clientName: row.client_name,
    clientCompany: row.client_company ?? null,
    clientEmail: row.client_email ?? null,
    status: row.status,
    currency: row.currency,
    subtotal: parseNumeric(row.subtotal),
    discount: parseNumeric(row.discount),
    tax: parseNumeric(row.tax),
    total: parseNumeric(row.total),
    summary: row.summary ?? null,
    body: row.body,
    variables: row.variables ?? {},
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    declinedAt: row.declined_at ? new Date(row.declined_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    lineItems,
  };
}

function mapLineItems(rows: any[]): ProposalLineItem[] {
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    subtotal: Number(row.subtotal),
  }));
}

function mergeVariables(template: ProposalTemplate, payload: ProposalGeneratePayload, computed: Record<string, string | number>): Record<string, string | number> {
  const merged: Record<string, string | number> = {
    client_name: payload.client.name,
    client_company: payload.client.company ?? '',
    client_email: payload.client.email ?? '',
    proposal_number: computed.proposal_number,
    proposal_date: computed.proposal_date,
    currency: payload.currency ?? 'USD',
    ...payload.variables,
  };

  template.optionalTokens.forEach((token) => {
    if (merged[token] === undefined) {
      merged[token] = '';
    }
  });

  return merged;
}

async function fetchProposalById(proposalId: string, executor?: Pool | PoolClient): Promise<Proposal | null> {
  const db = executor ?? getDbPool();

  const proposalResult = await db.query(
    `SELECT
       id,
       user_id,
       template_id,
       proposal_number,
       client_name,
       client_company,
       client_email,
       status,
       currency,
       subtotal,
       discount,
       tax,
       total,
       summary,
       body,
       variables,
       sent_at,
       accepted_at,
       declined_at,
       created_at,
       updated_at
     FROM proposals
     WHERE id = $1
     LIMIT 1`,
    [proposalId]
  );

  const proposalRow = proposalResult.rows[0];
  if (!proposalRow) {
    return null;
  }

  const lineItemsResult = await db.query(
    `SELECT
       id,
       proposal_id,
       position,
       description,
       quantity::numeric AS quantity,
       unit_price::numeric AS unit_price,
       subtotal::numeric AS subtotal
     FROM proposal_line_items
     WHERE proposal_id = $1
     ORDER BY position ASC`,
    [proposalId]
  );

  const lineItems = mapLineItems(lineItemsResult.rows);
  return mapProposalRow(proposalRow, lineItems);
}

async function fetchProposalByNumber(proposalNumber: string, executor?: Pool | PoolClient): Promise<Proposal | null> {
  const db = executor ?? getDbPool();
  const proposalResult = await db.query(
    `SELECT
       id,
       user_id,
       template_id,
       proposal_number,
       client_name,
       client_company,
       client_email,
       status,
       currency,
       subtotal,
       discount,
       tax,
       total,
       summary,
       body,
       variables,
       sent_at,
       accepted_at,
       declined_at,
       created_at,
       updated_at
     FROM proposals
     WHERE proposal_number = $1
     LIMIT 1`,
    [proposalNumber]
  );

  const proposalRow = proposalResult.rows[0];
  if (!proposalRow) {
    return null;
  }

  const lineItemsResult = await db.query(
    `SELECT
       id,
       proposal_id,
       position,
       description,
       quantity::numeric AS quantity,
       unit_price::numeric AS unit_price,
       subtotal::numeric AS subtotal
     FROM proposal_line_items
     WHERE proposal_id = $1
     ORDER BY position ASC`,
    [proposalRow.id]
  );

  const lineItems = mapLineItems(lineItemsResult.rows);
  return mapProposalRow(proposalRow, lineItems);
}

export class ProposalService {
  async generateProposal(payload: ProposalGeneratePayload): Promise<Proposal> {
    const template: ProposalTemplate | null = payload.templateId
      ? await templateService.getTemplateById(payload.templateId)
      : payload.templateName
        ? await templateService.getTemplateByName(payload.userId, payload.templateName)
        : null;

    if (!template) {
      throw new Error('Template not found for proposal generation.');
    }

    const proposalNumber = payload.proposalNumber ?? generateProposalNumber();
    const computedVars = {
      proposal_number: proposalNumber,
      proposal_date: new Date().toISOString().split('T')[0],
    };

    const mergedVariables = mergeVariables(template, payload, computedVars);
    const missingTokens = findMissingTokens(template.requiredTokens, mergedVariables);

    if (missingTokens.length > 0) {
      throw new Error(`Missing required tokens: ${missingTokens.join(', ')}`);
    }

    const normalizedLineItems = (payload.lineItems ?? []).map((item, index) => {
      const quantity = item.quantity ?? 1;
      const unitPrice = item.unitPrice ?? 0;
      const subtotal = Number((quantity * unitPrice).toFixed(2));
      return {
        position: index + 1,
        description: item.description,
        quantity,
        unitPrice,
        subtotal,
      };
    });

    const subtotal = normalizedLineItems.reduce((acc, item) => acc + item.subtotal, 0);
    const discount = payload.discount ?? 0;
    const tax = payload.tax ?? 0;
    const total = Number((subtotal - discount + tax).toFixed(2));

    mergedVariables.total_value = Number.isFinite(total) ? total.toFixed(2) : '0.00';
    if (Number.isFinite(subtotal)) {
      mergedVariables.subtotal_value = subtotal.toFixed(2);
    }
    if (Number.isFinite(discount) && discount !== 0) {
      mergedVariables.discount_value = discount.toFixed(2);
    }
    if (Number.isFinite(tax) && tax !== 0) {
      mergedVariables.tax_value = tax.toFixed(2);
    }

    const renderedBody = renderTemplate(template.body, mergedVariables);

    const proposal = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO proposals (
           user_id,
           template_id,
           proposal_number,
           client_name,
           client_company,
           client_email,
           status,
           currency,
           subtotal,
           discount,
           tax,
           total,
           summary,
           body,
           variables
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          payload.userId ?? null,
          template.id,
          proposalNumber,
          payload.client.name,
          payload.client.company ?? null,
          payload.client.email ?? null,
          payload.status ?? 'draft',
          payload.currency ?? 'USD',
          subtotal,
          discount,
          tax,
          total,
          payload.summary ?? null,
          renderedBody,
          mergedVariables,
        ]
      );

      const proposalId = inserted.rows[0].id as string;

      if (normalizedLineItems.length > 0) {
        await Promise.all(
          normalizedLineItems.map((item) =>
            client.query(
              `INSERT INTO proposal_line_items (
                 proposal_id,
                 position,
                 description,
                 quantity,
                 unit_price
               ) VALUES ($1, $2, $3, $4, $5)`,
              [
                proposalId,
                item.position,
                item.description,
                item.quantity,
                item.unitPrice,
              ]
            )
          )
        );
      }

      return fetchProposalById(proposalId, client) as Promise<Proposal>;
    });

    return proposal;
  }

  async markProposalSent(proposalId: string, note?: string): Promise<Proposal> {
    const pool = getDbPool();
    const updated = await pool.query(
      `UPDATE proposals
       SET
         status = 'sent',
         sent_at = NOW(),
         updated_at = NOW(),
         variables = CASE
           WHEN $2::text IS NULL THEN variables
           ELSE COALESCE(variables, '{}'::jsonb) || jsonb_build_object('last_send_note', $2)
         END
       WHERE id = $1
       RETURNING id`,
      [proposalId, note ?? null]
    );

    if (updated.rowCount === 0) {
      throw new Error('Proposal not found.');
    }

    const proposal = await fetchProposalById(updated.rows[0].id as string);
    if (!proposal) {
      throw new Error('Failed to load proposal after update.');
    }

    return proposal;
  }

  async getProposalById(proposalId: string): Promise<Proposal | null> {
    return fetchProposalById(proposalId);
  }

  async getProposalByNumber(proposalNumber: string): Promise<Proposal | null> {
    return fetchProposalByNumber(proposalNumber);
  }
}

export const proposalService = new ProposalService();
