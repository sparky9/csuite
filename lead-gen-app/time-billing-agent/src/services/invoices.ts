import type pg from 'pg';
import { withTransaction } from '../db/client.js';
import { getDefaultNetTerms } from '../utils/config.js';
import { roundCurrency } from '../utils/currency.js';
import { recordEvent } from './events.js';
import {
  fetchEntriesByIds,
  fetchUnbilledEntries,
  markEntriesAsInvoiced
} from './time-entries.js';
import type { Invoice, TimeEntry } from '../types/index.js';

export interface InvoiceRow {
  id: string;
  user_id: string;
  invoice_number: string;
  client_id: string;
  invoice_date: string;
  due_date: string;
  status: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_paid: string;
  notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  delivery_method: string | null;
  recipient_email: string | null;
  created_at: string;
  updated_at: string;
}

export function mapInvoiceRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    notes: row.notes,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    paidAt: row.paid_at,
    deliveryMethod: row.delivery_method,
    recipientEmail: row.recipient_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

interface GenerateInvoiceInput {
  userId: string;
  clientId: string;
  timeEntryIds?: string[];
  invoiceDate?: string;
  dueDate?: string;
  notes?: string;
  taxRate?: number;
  discountAmount?: number;
}

export interface GenerateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  dueDate: string;
  status: string;
  timeEntriesIncluded: number;
}

function ensureIsoDate(value: string | undefined, fallback: () => string): string {
  if (!value) {
    return fallback();
  }
  return value.slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ensureNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

function computeEntryAmount(entry: TimeEntry): number {
  const rate = entry.hourlyRate ?? 0;
  const amount = entry.calculatedAmount ?? roundCurrency((entry.durationMinutes / 60) * rate);
  return roundCurrency(amount);
}

async function generateInvoiceNumber(client: pg.PoolClient, userId: string, invoiceDate: string): Promise<string> {
  const year = invoiceDate.slice(0, 4);
  const prefix = `INV-${year}-`;
  const { rows } = await client.query<{ invoice_number: string }>(
    `SELECT invoice_number
       FROM billing_invoices
      WHERE user_id = $1
        AND invoice_number LIKE $2
      ORDER BY invoice_number DESC
      LIMIT 1`,
    [userId, `${prefix}%`]
  );

  if (rows.length === 0) {
    return `${prefix}001`;
  }

  const lastNumber = rows[0].invoice_number;
  const numericPart = Number(lastNumber.replace(prefix, ''));
  const nextNumber = Number.isFinite(numericPart) ? numericPart + 1 : 1;
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

function ensureEntriesBillable(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((entry) => entry.billable);
}

export async function generateInvoice(input: GenerateInvoiceInput): Promise<GenerateInvoiceResult> {
  const {
    userId,
    clientId,
    timeEntryIds,
    invoiceDate: providedInvoiceDate,
    dueDate: providedDueDate,
    notes,
    taxRate = 0,
    discountAmount = 0
  } = input;

  return withTransaction(async (client) => {
    const invoiceDate = ensureIsoDate(providedInvoiceDate, () => new Date().toISOString().slice(0, 10));
    const defaultDueDate = addDays(invoiceDate, getDefaultNetTerms());
    const dueDate = ensureIsoDate(providedDueDate, () => defaultDueDate);

    const entries: TimeEntry[] = timeEntryIds && timeEntryIds.length > 0
      ? await fetchEntriesByIds(client, { userId, clientId, entryIds: timeEntryIds })
      : await fetchUnbilledEntries(client, { userId, clientId });

    const billableEntries = ensureEntriesBillable(entries).filter((entry) => !entry.invoiced);

    if (billableEntries.length === 0) {
      throw new Error('No billable time entries available for invoicing.');
    }

    const subtotal = roundCurrency(
      billableEntries.reduce((sum, entry) => sum + computeEntryAmount(entry), 0)
    );
    const normalizedTaxRate = taxRate > 0 ? taxRate : 0;
    const taxAmount = roundCurrency(subtotal * (normalizedTaxRate / 100));
    const normalizedDiscount = discountAmount > 0 ? discountAmount : 0;
    const total = ensureNonNegative(roundCurrency(subtotal + taxAmount - normalizedDiscount));

    const invoiceNumber = await generateInvoiceNumber(client, userId, invoiceDate);

    const insertResult = await client.query<InvoiceRow>(
      `INSERT INTO billing_invoices (
        user_id, invoice_number, client_id, invoice_date, due_date, status, subtotal,
        tax_rate, tax_amount, discount_amount, total_amount, amount_paid, notes
      ) VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, 0, $11)
      RETURNING *`,
      [
        userId,
        invoiceNumber,
        clientId,
        invoiceDate,
        dueDate,
        subtotal,
        normalizedTaxRate,
        taxAmount,
        normalizedDiscount,
        total,
        notes ?? null
      ]
    );

    const invoice = mapInvoiceRow(insertResult.rows[0]);

    await markEntriesAsInvoiced(client, {
      entryIds: billableEntries.map((entry) => entry.id),
      invoiceId: invoice.id
    });

    await recordEvent(client, {
      userId,
      eventType: 'invoice_created',
      entityType: 'billing_invoice',
      entityId: invoice.id,
      eventData: {
        clientId,
        subtotal,
        taxAmount,
        discountAmount: normalizedDiscount,
        total,
        timeEntries: billableEntries.length
      }
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId,
      subtotal,
      tax: taxAmount,
      discount: normalizedDiscount,
      total,
      dueDate: invoice.dueDate,
      status: invoice.status,
      timeEntriesIncluded: billableEntries.length
    };
  });
}

export interface SendInvoiceInput {
  invoiceId: string;
  deliveryMethod?: 'email' | 'mail' | 'portal';
  recipientEmail?: string | null;
}

export interface SendInvoiceResult {
  invoiceId: string;
  status: string;
  sentAt: string;
  deliveryMethod: string;
  trackingEnabled: boolean;
}

export async function sendInvoice(input: SendInvoiceInput): Promise<SendInvoiceResult> {
  const { invoiceId, deliveryMethod = 'email', recipientEmail = null } = input;
  const sentAt = new Date().toISOString();

  return withTransaction(async (client) => {
    const result = await client.query<InvoiceRow>(
      `UPDATE billing_invoices
          SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
              sent_at = $2,
              delivery_method = $3,
              recipient_email = COALESCE($4, recipient_email)
        WHERE id = $1
        RETURNING *`,
      [invoiceId, sentAt, deliveryMethod, recipientEmail]
    );

    if (result.rows.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoice = mapInvoiceRow(result.rows[0]);

    await recordEvent(client, {
      userId: invoice.userId,
      eventType: 'invoice_sent',
      entityType: 'billing_invoice',
      entityId: invoice.id,
      eventData: {
        deliveryMethod,
        recipientEmail: recipientEmail ?? invoice.recipientEmail,
        sentAt
      }
    });

    return {
      invoiceId: invoice.id,
      status: invoice.status,
      sentAt: invoice.sentAt ?? sentAt,
      deliveryMethod,
      trackingEnabled: deliveryMethod === 'email' || deliveryMethod === 'portal'
    };
  });
}

export interface InvoiceStatusResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  sentAt: string | null;
  viewedAt: string | null;
  dueDate: string;
  daysOverdue: number;
  total: number;
  amountPaid: number;
  amountDue: number;
}

function calculateDaysOverdue(dueDate: string, amountDue: number): number {
  if (amountDue <= 0) {
    return 0;
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  if (todayIso <= dueDate) {
    return 0;
  }
  const due = new Date(dueDate);
  const today = new Date(todayIso);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export async function getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult> {
  const result = await withTransaction(async (client) => {
    const query = await client.query<InvoiceRow>('SELECT * FROM billing_invoices WHERE id = $1', [invoiceId]);
    if (query.rows.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoice = mapInvoiceRow(query.rows[0]);
    const amountDue = roundCurrency(invoice.totalAmount - invoice.amountPaid);
    const daysOverdue = calculateDaysOverdue(invoice.dueDate, amountDue);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: daysOverdue > 0 && amountDue > 0 && invoice.status !== 'paid' ? 'overdue' : invoice.status,
      sentAt: invoice.sentAt,
      viewedAt: invoice.viewedAt,
      dueDate: invoice.dueDate,
      daysOverdue,
      total: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      amountDue
    };
  });

  return result;
}

export async function updateInvoicePaymentSummary(
  client: pg.PoolClient,
  invoiceId: string
): Promise<InvoiceRow> {
  const result = await client.query<InvoiceRow>(
    `UPDATE billing_invoices
        SET amount_paid = (
              SELECT COALESCE(SUM(amount), 0)
                FROM billing_payments
               WHERE invoice_id = $1
            ),
            status = CASE
              WHEN amount_paid >= total_amount THEN 'paid'
              WHEN sent_at IS NOT NULL THEN status
              ELSE status
            END,
            paid_at = CASE
              WHEN amount_paid >= total_amount THEN COALESCE(paid_at, NOW())
              ELSE paid_at
            END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [invoiceId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  return result.rows[0];
}
