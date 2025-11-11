import type pg from 'pg';
import { withTransaction } from '../db/client.js';
import { resolveEffectiveRate } from './rate-cards.js';
import { recordEvent } from './events.js';
import type { TimeEntry } from '../types/index.js';
import { roundCurrency } from '../utils/currency.js';

interface TimeEntryRow {
  id: string;
  user_id: string;
  client_id: string;
  project_name: string;
  task_description: string;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  billable: boolean;
  invoiced: boolean;
  invoice_id: string | null;
  hourly_rate: string | null;
  calculated_amount: string | null;
  notes: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    projectName: row.project_name,
    taskDescription: row.task_description,
    durationMinutes: row.duration_minutes,
    startTime: row.start_time,
    endTime: row.end_time,
    billable: row.billable,
    invoiced: row.invoiced,
    invoiceId: row.invoice_id,
    hourlyRate: row.hourly_rate !== null ? Number(row.hourly_rate) : null,
    calculatedAmount: row.calculated_amount !== null ? Number(row.calculated_amount) : null,
    notes: row.notes,
    entryDate: row.entry_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function deriveEntryDate(startTime?: string | null, endTime?: string | null): string {
  if (startTime) {
    return startTime.slice(0, 10);
  }
  if (endTime) {
    return endTime.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export interface CreateTimeEntryInput {
  userId: string;
  clientId: string;
  projectName: string;
  taskDescription: string;
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  billable?: boolean;
  notes?: string | null;
}

export interface CreateTimeEntryResult {
  entryId: string;
  duration: number;
  billable: boolean;
  calculatedAmount: number;
  hourlyRate: number;
  currency: string;
  rateSource: 'project' | 'client' | 'default' | 'fallback';
}

export async function createTimeEntry(input: CreateTimeEntryInput): Promise<CreateTimeEntryResult> {
  const {
    userId,
    clientId,
    projectName,
    taskDescription,
    durationMinutes,
    startTime = null,
    endTime = null,
    billable = true,
    notes = null
  } = input;

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Duration must be a positive number of minutes.');
  }

  return withTransaction(async (client) => {
    const rate = await resolveEffectiveRate({ client, userId, clientId, projectName });
    const entryDate = deriveEntryDate(startTime, endTime);
    const amount = billable ? roundCurrency((durationMinutes / 60) * rate.hourlyRate) : 0;

    const result = await client.query<TimeEntryRow>(
      `INSERT INTO time_entries (
        user_id, client_id, project_name, task_description, duration_minutes,
        start_time, end_time, billable, hourly_rate, calculated_amount, notes, entry_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId,
        clientId,
        projectName,
        taskDescription,
        durationMinutes,
        startTime,
        endTime,
        billable,
        billable ? rate.hourlyRate : null,
        billable ? amount : 0,
        notes,
        entryDate
      ]
    );

    const created = mapRow(result.rows[0]);

    await recordEvent(client, {
      userId,
      eventType: 'time_entry_created',
      entityType: 'time_entry',
      entityId: created.id,
      eventData: {
        clientId,
        projectName,
        durationMinutes,
        billable,
        amount,
        rateSource: rate.source
      }
    });

    return {
      entryId: created.id,
      duration: created.durationMinutes,
      billable: created.billable,
      calculatedAmount: created.calculatedAmount ?? 0,
      hourlyRate: created.hourlyRate ?? rate.hourlyRate,
      currency: rate.currency,
      rateSource: rate.source
    };
  });
}

export interface ListTimeEntriesInput {
  userId: string;
  clientId?: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
  billable?: boolean;
  invoiced?: boolean;
  limit?: number;
}

export interface ListTimeEntriesResult {
  entries: Array<
    TimeEntry & {
      amount: number;
      date: string;
    }
  >;
  totalHours: number;
  totalAmount: number;
  unbilledAmount: number;
}

function buildWhereClause(
  params: ListTimeEntriesInput
): { clause: string; values: Array<string | number | boolean | null>; limit: number } {
  const conditions: string[] = ['user_id = $1'];
  const values: Array<string | number | boolean | null> = [params.userId];
  let index = 2;

  if (params.clientId) {
    conditions.push(`client_id = $${index}`);
    values.push(params.clientId);
    index += 1;
  }

  if (params.projectName) {
    conditions.push(`project_name = $${index}`);
    values.push(params.projectName);
    index += 1;
  }

  if (params.startDate) {
    conditions.push(`entry_date >= $${index}`);
    values.push(params.startDate);
    index += 1;
  }

  if (params.endDate) {
    conditions.push(`entry_date <= $${index}`);
    values.push(params.endDate);
    index += 1;
  }

  if (typeof params.billable === 'boolean') {
    conditions.push(`billable = $${index}`);
    values.push(params.billable);
    index += 1;
  }

  if (typeof params.invoiced === 'boolean') {
    conditions.push(`invoiced = $${index}`);
    values.push(params.invoiced);
    index += 1;
  }

  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 200) : 50;

  return {
    clause: conditions.join(' AND '),
    values,
    limit
  };
}

export async function listTimeEntries(params: ListTimeEntriesInput): Promise<ListTimeEntriesResult> {
  const { clause, values, limit } = buildWhereClause(params);

  const entriesQuery = `SELECT * FROM time_entries WHERE ${clause} ORDER BY entry_date DESC, created_at DESC LIMIT $${
    values.length + 1
  }`;
  const aggregateQuery = `SELECT
      COALESCE(SUM(duration_minutes), 0) AS total_minutes,
      COALESCE(SUM(calculated_amount), 0) AS total_amount,
      COALESCE(SUM(CASE WHEN invoiced = false THEN calculated_amount ELSE 0 END), 0) AS unbilled_amount
    FROM time_entries
    WHERE ${clause}`;

  return withTransaction(async (client) => {
    const entriesResult = await client.query<TimeEntryRow>(entriesQuery, [...values, limit]);
    const aggregateResult = await client.query<{ total_minutes: string; total_amount: string; unbilled_amount: string }>(
      aggregateQuery,
      values
    );

    const mappedEntries = entriesResult.rows.map((row: TimeEntryRow) => {
      const mapped = mapRow(row);
      return {
        ...mapped,
        amount: mapped.calculatedAmount ?? 0,
        date: mapped.entryDate
      };
    });

    const totals = aggregateResult.rows[0];
    const totalMinutes = Number(totals.total_minutes);

    return {
      entries: mappedEntries,
      totalHours: roundCurrency(totalMinutes / 60),
      totalAmount: roundCurrency(Number(totals.total_amount)),
      unbilledAmount: roundCurrency(Number(totals.unbilled_amount))
    };
  });
}

export async function markEntriesAsInvoiced(
  client: pg.PoolClient,
  params: { entryIds: string[]; invoiceId: string }
): Promise<void> {
  const { entryIds, invoiceId } = params;
  if (entryIds.length === 0) {
    return;
  }

  await client.query(
    `UPDATE time_entries
        SET invoiced = true,
            invoice_id = $2
      WHERE id = ANY($1::uuid[])`,
    [entryIds, invoiceId]
  );
}

export async function fetchEntriesByIds(
  client: pg.PoolClient,
  params: { userId: string; clientId: string; entryIds: string[] }
): Promise<TimeEntry[]> {
  const { userId, clientId, entryIds } = params;
  if (entryIds.length === 0) {
    return [];
  }

  const result = await client.query<TimeEntryRow>(
    `SELECT *
       FROM time_entries
      WHERE user_id = $1
        AND client_id = $2
        AND id = ANY($3::uuid[])`,
    [userId, clientId, entryIds]
  );

  return result.rows.map(mapRow);
}

export async function fetchUnbilledEntries(
  client: pg.PoolClient,
  params: { userId: string; clientId: string }
): Promise<TimeEntry[]> {
  const { userId, clientId } = params;
  const result = await client.query<TimeEntryRow>(
    `SELECT *
       FROM time_entries
      WHERE user_id = $1
        AND client_id = $2
        AND billable = true
        AND invoiced = false
      ORDER BY entry_date ASC, created_at ASC`,
    [userId, clientId]
  );
  return result.rows.map(mapRow);
}
