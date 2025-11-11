import { withTransaction } from '../db/client.js';
import { roundCurrency } from '../utils/currency.js';
import { recordEvent } from './events.js';
import { getInvoiceStatus, mapInvoiceRow, updateInvoicePaymentSummary } from './invoices.js';
import type { InvoiceRow } from './invoices.js';
import type { Invoice, Payment, Reminder } from '../types/index.js';

interface PaymentRow {
  id: string;
  invoice_id: string;
  user_id: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReminderRow {
  id: string;
  invoice_id: string;
  user_id: string;
  tone: string;
  subject: string;
  message_body: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    userId: row.user_id,
    amount: Number(row.amount),
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    userId: row.user_id,
    tone: row.tone,
    subject: row.subject,
    messageBody: row.message_body,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'check' | 'ach' | 'credit_card' | 'wire' | 'paypal' | 'stripe';
  transactionId?: string;
  notes?: string;
}

export interface RecordPaymentResult {
  paymentId: string;
  invoiceId: string;
  amountPaid: number;
  remainingBalance: number;
  invoiceStatus: string;
  paidAt: string | null;
}

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const {
    invoiceId,
    amount,
    paymentDate,
    paymentMethod,
    transactionId = undefined,
    notes = undefined
  } = input;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  return withTransaction(async (client) => {
    const invoiceResult = await client.query<InvoiceRow>(
      `SELECT * FROM billing_invoices WHERE id = $1 FOR UPDATE`,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoiceRow = invoiceResult.rows[0];
    const invoice = mapInvoiceRow(invoiceRow);

    const paymentInsert = await client.query<PaymentRow>(
      `INSERT INTO billing_payments (
        invoice_id, user_id, amount, payment_date, payment_method, transaction_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        invoiceId,
        invoice.userId,
        roundCurrency(amount),
        paymentDate,
        paymentMethod,
        transactionId ?? null,
        notes ?? null
      ]
    );

    const payment = mapPayment(paymentInsert.rows[0]);
    const updatedInvoiceRow = await updateInvoicePaymentSummary(client, invoiceId);
    const updatedInvoice = mapInvoiceRow(updatedInvoiceRow);

    await recordEvent(client, {
      userId: updatedInvoice.userId,
      eventType: 'payment_recorded',
      entityType: 'billing_payment',
      entityId: payment.id,
      eventData: {
        invoiceId,
        amount: payment.amount,
        paymentMethod,
        paymentDate
      }
    });

    const remainingBalance = roundCurrency(updatedInvoice.totalAmount - updatedInvoice.amountPaid);

    return {
      paymentId: payment.id,
      invoiceId,
      amountPaid: updatedInvoice.amountPaid,
      remainingBalance,
      invoiceStatus: updatedInvoice.status,
      paidAt: updatedInvoice.paidAt
    };
  });
}

type ReminderTone = 'friendly' | 'firm' | 'urgent';

interface GenerateReminderInput {
  invoiceId: string;
  tone?: ReminderTone;
}

export interface GenerateReminderResult {
  reminderId: string;
  invoiceNumber: string;
  tone: ReminderTone;
  subject: string;
  messageBody: string;
  suggestedSendDate: string;
}

const toneSubjectMap: Record<ReminderTone, (invoiceNumber: string) => string> = {
  friendly: (number) => `Friendly reminder: Invoice ${number} due soon`,
  firm: (number) => `Payment reminder: Invoice ${number}`,
  urgent: (number) => `Urgent: Invoice ${number} requires attention`
};

function buildReminderBody(
  tone: ReminderTone,
  invoice: Invoice,
  amountDue: number
): string {
  const greeting = tone === 'friendly' ? 'Hi there' : 'Hello';
  const opener =
    tone === 'friendly'
      ? `Just a friendly reminder that invoice ${invoice.invoiceNumber} is coming due on ${invoice.dueDate}.`
      : tone === 'firm'
        ? `This is a reminder that invoice ${invoice.invoiceNumber} was due on ${invoice.dueDate}.`
        : `Invoice ${invoice.invoiceNumber} is overdue and requires immediate attention.`;
  const amountLine = `Outstanding balance: $${amountDue.toFixed(2)}.`;
  const closing =
    tone === 'urgent'
      ? 'Please submit payment as soon as possible or let me know if there is anything blocking it.'
      : 'Let me know if you have any questions or need support to wrap this up.';

  return `${greeting},

${opener}
${amountLine}

${closing}

Thanks,
Your Time & Billing Assistant`;
}

function determineSuggestedDate(tone: ReminderTone, invoice: Invoice, amountDue: number): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (tone === 'friendly') {
    if (invoice.dueDate > todayIso && amountDue > 0) {
      return invoice.dueDate;
    }
    return todayIso;
  }
  return todayIso;
}

export async function generatePaymentReminder(input: GenerateReminderInput): Promise<GenerateReminderResult> {
  const { invoiceId, tone = 'friendly' } = input;

  return withTransaction(async (client) => {
    const status = await getInvoiceStatus(invoiceId);
    const amountDue = roundCurrency(status.amountDue);

    if (amountDue <= 0) {
      throw new Error('Invoice is already paid. No reminder necessary.');
    }

    const invoiceQuery = await client.query<InvoiceRow>(
      `SELECT * FROM billing_invoices WHERE id = $1`,
      [invoiceId]
    );

    if (invoiceQuery.rows.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoice = mapInvoiceRow(invoiceQuery.rows[0]);

    const subject = toneSubjectMap[tone](status.invoiceNumber);
    const messageBody = buildReminderBody(tone, invoice, amountDue);
    const suggestedSendDate = determineSuggestedDate(tone, invoice, amountDue);

    const insert = await client.query<ReminderRow>(
      `INSERT INTO billing_reminders (invoice_id, user_id, tone, subject, message_body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [invoiceId, invoice.userId, tone, subject, messageBody]
    );

    const reminder = mapReminder(insert.rows[0]);

    await recordEvent(client, {
      userId: invoice.userId,
      eventType: 'payment_reminder_generated',
      entityType: 'billing_reminder',
      entityId: reminder.id,
      eventData: {
        invoiceId,
        tone,
        suggestedSendDate
      }
    });

    return {
      reminderId: reminder.id,
      invoiceNumber: status.invoiceNumber,
      tone,
      subject,
      messageBody,
      suggestedSendDate
    };
  });
}
