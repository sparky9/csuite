import { withTransaction } from '../db/client.js';
import { roundCurrency } from '../utils/currency.js';

interface TimeEntryAggregateRow {
  client_id: string;
  total_minutes: string;
}

interface InvoiceAggregateRow {
  client_id: string;
  total_billed: string;
  outstanding: string;
  avg_days_to_pay: string | null;
}

interface PaymentAggregateRow {
  client_id: string;
  total_paid: string;
}

export interface ProfitabilityReportInput {
  userId: string;
  clientId?: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProfitabilityClientEntry {
  clientId: string;
  clientName: string;
  totalHours: number;
  totalBilled: number;
  totalPaid: number;
  avgHourlyRate: number;
  paymentVelocity: 'fast' | 'on_time' | 'slow';
  profitMargin: 'high' | 'medium' | 'low';
}

export interface ProfitabilityReportResult {
  clients: ProfitabilityClientEntry[];
  summary: {
    totalRevenue: number;
    totalOutstanding: number;
    avgPaymentDays: number;
    topClient: string | null;
  };
}

function buildDateCondition(
  column: string,
  offset: number,
  start?: string,
  end?: string
): { clause: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (start) {
    clauses.push(`${column} >= $${offset + values.length + 1}`);
    values.push(start);
  }
  if (end) {
    clauses.push(`${column} <= $${offset + values.length + 1}`);
    values.push(end);
  }
  return {
    clause: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    values
  };
}

function classifyPaymentVelocity(avgDays: number | null): 'fast' | 'on_time' | 'slow' {
  if (avgDays === null || Number.isNaN(avgDays)) {
    return 'on_time';
  }
  if (avgDays <= 15) {
    return 'fast';
  }
  if (avgDays <= 30) {
    return 'on_time';
  }
  return 'slow';
}

function classifyProfitMargin(ratio: number): 'high' | 'medium' | 'low' {
  if (ratio >= 0.75) {
    return 'high';
  }
  if (ratio >= 0.5) {
    return 'medium';
  }
  return 'low';
}

export async function getProfitabilityReport(
  params: ProfitabilityReportInput
): Promise<ProfitabilityReportResult> {
  const { userId, clientId, projectName, startDate, endDate } = params;

  return withTransaction(async (client) => {
    const entryDateFilter = buildDateCondition('entry_date', 3, startDate, endDate);
    const invoiceDateFilter = buildDateCondition('invoice_date', 2, startDate, endDate);
    const paymentDateFilter = buildDateCondition('p.payment_date', 2, startDate, endDate);

    const entryValues = [userId, clientId ?? null, projectName ?? null, ...entryDateFilter.values];
    const invoiceValues = [userId, clientId ?? null, ...invoiceDateFilter.values];
    const paymentValues = [userId, clientId ?? null, ...paymentDateFilter.values];

    const [timeEntries, invoices, payments] = await Promise.all([
      client.query<TimeEntryAggregateRow>(
        `SELECT client_id, COALESCE(SUM(duration_minutes), 0) AS total_minutes
           FROM time_entries
          WHERE user_id = $1
            AND ($2::text IS NULL OR client_id = $2)
            AND ($3::text IS NULL OR project_name = $3)
            ${entryDateFilter.clause}
          GROUP BY client_id`,
        entryValues
      ),
      client.query<InvoiceAggregateRow>(
        `SELECT client_id,
                COALESCE(SUM(total_amount), 0) AS total_billed,
                COALESCE(SUM(total_amount - amount_paid), 0) AS outstanding,
                AVG(CASE
                      WHEN amount_paid > 0 THEN EXTRACT(EPOCH FROM COALESCE(paid_at, NOW()) - invoice_date) / 86400
                    END) AS avg_days_to_pay
           FROM billing_invoices
          WHERE user_id = $1
            AND ($2::text IS NULL OR client_id = $2)
            ${invoiceDateFilter.clause}
          GROUP BY client_id`,
        invoiceValues
      ),
      client.query<PaymentAggregateRow>(
        `SELECT i.client_id,
                COALESCE(SUM(p.amount), 0) AS total_paid
           FROM billing_payments p
           JOIN billing_invoices i ON p.invoice_id = i.id
          WHERE i.user_id = $1
            AND ($2::text IS NULL OR i.client_id = $2)
            ${paymentDateFilter.clause}
          GROUP BY i.client_id`,
        paymentValues
      )
    ]);

    const clientIds = new Set<string>();
    let invoiceRows = invoices.rows;
    let paymentRows = payments.rows;

    if (projectName && !clientId) {
      const projectClientIds = new Set(timeEntries.rows.map((row) => row.client_id));
      invoiceRows = invoiceRows.filter((row) => projectClientIds.has(row.client_id));
      paymentRows = paymentRows.filter((row) => projectClientIds.has(row.client_id));
    }

    timeEntries.rows.forEach((row: TimeEntryAggregateRow) => clientIds.add(row.client_id));
    invoiceRows.forEach((row: InvoiceAggregateRow) => clientIds.add(row.client_id));
    paymentRows.forEach((row: PaymentAggregateRow) => clientIds.add(row.client_id));

    const clients: ProfitabilityClientEntry[] = [];
    let totalRevenue = 0;
    let totalOutstanding = 0;
    let weightedPaymentDays = 0;
    let paymentSamples = 0;
    let topClient: { id: string; paid: number } | null = null;

    for (const id of clientIds) {
      const entryRow = timeEntries.rows.find((row: TimeEntryAggregateRow) => row.client_id === id);
      const invoiceRow = invoiceRows.find((row: InvoiceAggregateRow) => row.client_id === id);
      const paymentRow = paymentRows.find((row: PaymentAggregateRow) => row.client_id === id);

      const hours = entryRow ? roundCurrency(Number(entryRow.total_minutes) / 60) : 0;
      const billed = invoiceRow ? roundCurrency(Number(invoiceRow.total_billed)) : 0;
      const paid = paymentRow ? roundCurrency(Number(paymentRow.total_paid)) : 0;
      const outstanding = invoiceRow ? roundCurrency(Number(invoiceRow.outstanding)) : 0;
      const avgRate = hours > 0 ? roundCurrency(billed / hours) : 0;
      const avgDays = invoiceRow && invoiceRow.avg_days_to_pay !== null ? Number(invoiceRow.avg_days_to_pay) : null;
      const paymentVelocity = classifyPaymentVelocity(avgDays);
      const margin = billed > 0 ? classifyProfitMargin(paid / billed) : 'medium';

      if (invoiceRow && avgDays !== null) {
        weightedPaymentDays += avgDays;
        paymentSamples += 1;
      }

      totalRevenue += billed;
      totalOutstanding += outstanding;

      if (!topClient || paid > topClient.paid) {
        topClient = { id, paid };
      }

      clients.push({
        clientId: id,
        clientName: id,
        totalHours: hours,
        totalBilled: billed,
        totalPaid: paid,
        avgHourlyRate: avgRate,
        paymentVelocity,
        profitMargin: margin
      });
    }

    clients.sort((a, b) => b.totalPaid - a.totalPaid);

    return {
      clients,
      summary: {
        totalRevenue: roundCurrency(totalRevenue),
        totalOutstanding: roundCurrency(totalOutstanding),
        avgPaymentDays: paymentSamples > 0 ? roundCurrency(weightedPaymentDays / paymentSamples) : 0,
        topClient: topClient ? topClient.id : null
      }
    };
  });
}
