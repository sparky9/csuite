/**
 * MCP Tool: Generate Invoice
 * Generate professional invoices for clients
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildInvoiceDraft } from '../ai/generator.js';
import { logger } from '../utils/logger.js';
import { bookkeepingDb } from '../db/client.js';
import type { GenerateInvoiceParams, InvoiceResult } from '../types/bookkeeping.types.js';

export const generateInvoiceTool: Tool = {
  name: 'generate_invoice',
  description: `Generate professional invoices for clients with customizable items and tax calculations.

Creates well-formatted invoices ready for sending to clients.

Required parameters:
- client_name: Client's full name or company name
- client_email: Client's email address
- items: Array of invoice items with description, quantity, unit_price
- due_date: Invoice due date in YYYY-MM-DD format

Optional parameters:
- notes: Additional notes or terms
- tax_rate: Tax rate as decimal (e.g., 0.10 for 10%)
- user_id: User ID for multi-tenant support

Returns:
- invoice_number: Unique invoice number
- total_amount: Total amount including tax
- due_date: Due date
- items: Invoice items with totals
- html_content: HTML formatted invoice
- plain_text: Plain text version

Example:
{
  "client_name": "Acme Corp",
  "client_email": "billing@acme.com",
  "items": [
    {
      "description": "Web Development Services",
      "quantity": 40,
      "unit_price": 100,
      "total": 4000
    }
  ],
  "due_date": "2024-02-15",
  "tax_rate": 0.10,
  "notes": "Payment due within 30 days"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      client_name: { type: 'string', description: 'Client name' },
      client_email: { type: 'string', description: 'Client email' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            total: { type: 'number' },
          },
          required: ['description', 'quantity', 'unit_price', 'total'],
        },
        description: 'Invoice items',
      },
      due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
      notes: { type: 'string', description: 'Additional notes (optional)' },
      tax_rate: { type: 'number', description: 'Tax rate (optional)' },
    },
    required: ['client_name', 'client_email', 'items', 'due_date'],
  },
};

export async function handleGenerateInvoice(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as GenerateInvoiceParams;

    logger.info('Generating invoice', {
      userId: params.user_id || userId,
      client: params.client_name,
      itemsCount: params.items.length,
    });

    const normalizedItems = params.items.map(item => ({
      ...item,
      total: Number((item.quantity * item.unit_price).toFixed(2)),
    }));

    const invoiceParams: GenerateInvoiceParams = {
      ...params,
      items: normalizedItems,
    };

    const invoice: InvoiceResult = buildInvoiceDraft(invoiceParams);

    if (bookkeepingDb.connected) {
      const issueDate = new Date().toISOString().slice(0, 10);
      const inserted = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_invoices (user_id, invoice_number, client_name, client_email, issue_date, due_date, subtotal, tax_rate, tax_amount, total, notes, html_content, plain_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (invoice_number) DO UPDATE
           SET client_name = EXCLUDED.client_name,
               client_email = EXCLUDED.client_email,
               due_date = EXCLUDED.due_date,
               subtotal = EXCLUDED.subtotal,
               tax_rate = EXCLUDED.tax_rate,
               tax_amount = EXCLUDED.tax_amount,
               total = EXCLUDED.total,
               notes = EXCLUDED.notes,
               html_content = EXCLUDED.html_content,
               plain_text = EXCLUDED.plain_text
         RETURNING id`,
        [
          params.user_id || userId || null,
          invoice.invoice_number,
          params.client_name,
          params.client_email,
          issueDate,
          params.due_date,
          invoice.subtotal,
          params.tax_rate ?? 0,
          invoice.tax_amount,
          invoice.total_amount,
          params.notes ?? null,
          invoice.html_content,
          invoice.plain_text,
        ],
      );

      const invoiceDatabaseId = inserted.rows[0]?.id;

      if (invoiceDatabaseId) {
        invoice.metadata = {
          database_id: invoiceDatabaseId,
          issue_date: issueDate,
        };

        await bookkeepingDb.query('DELETE FROM bk_invoice_items WHERE invoice_id = $1', [invoiceDatabaseId]);

        await Promise.all(
          invoice.items.map(item =>
            bookkeepingDb.query(
              `INSERT INTO bk_invoice_items (invoice_id, description, quantity, unit_price, total)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                invoiceDatabaseId,
                item.description,
                item.quantity,
                item.unit_price,
                item.total,
              ],
            ),
          ),
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Invoice generated successfully', {
      userId: params.user_id || userId,
      invoiceNumber: invoice.invoice_number,
      total: invoice.total_amount,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              invoice,
              metadata: {
                client: params.client_name,
                total: invoice.total_amount,
                generation_time_ms: duration,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('generate_invoice tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'generate_invoice',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
