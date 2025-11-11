/**
 * Analytics store for tracking generations and costs
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';

export interface AnalyticsEvent {
  id?: string;
  timestamp?: string;
  operation: string;
  prompt?: string;
  style?: string;
  model?: string;
  inputPath?: string;
  outputPath?: string;
  cost: number;
  processingTime?: number;
  metadata?: Record<string, unknown>;
}

export interface OperationBreakdown {
  operation: string;
  count: number;
  totalCost: number;
  averageCost: number;
  averageProcessingTime: number;
}

export interface MonthlySummary {
  month: string;
  totalCost: number;
  totalEvents: number;
  byOperation: OperationBreakdown[];
}

const ensureDirectory = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const monthToRange = (month: string): { start: string; end: string } => {
  const [year, monthPart] = month.split('-');
  if (!year || !monthPart) {
    throw new Error(`Invalid month format: ${month}. Expected YYYY-MM.`);
  }
  const startDate = new Date(Number(year), Number(monthPart) - 1, 1);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
};

const parseRow = (row: any): AnalyticsEvent => ({
  id: row.id,
  timestamp: row.timestamp,
  operation: row.operation,
  prompt: row.prompt ?? undefined,
  style: row.style ?? undefined,
  model: row.model ?? undefined,
  inputPath: row.input_path ?? undefined,
  outputPath: row.output_path ?? undefined,
  cost: row.cost ?? 0,
  processingTime: row.processing_time ?? undefined,
  metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
});

export class AnalyticsStore {
  private db: Database.Database;

  constructor(private dbPath: string) {
    const resolved = path.resolve(dbPath);
    this.dbPath = resolved;
    try {
      ensureDirectory(resolved);
    } catch (error) {
      console.error('Failed to prepare analytics directory', error);
    }
    const connection = this.connect();
    this.db = connection;
    this.initialise();
  }

  private connect(): Database.Database {
    const resolved = this.dbPath;
    return new Database(resolved, { fileMustExist: false });
  }

  private initialise(): void {
    this.db
      .prepare(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          operation TEXT NOT NULL,
          prompt TEXT,
          style TEXT,
          model TEXT,
          input_path TEXT,
          output_path TEXT,
          cost REAL NOT NULL,
          processing_time REAL,
          metadata TEXT
        )
      `)
      .run();
  }

  logEvent(event: AnalyticsEvent): void {
    const id = event.id ?? randomUUID();
    const timestamp = event.timestamp ?? new Date().toISOString();
    const metadata = event.metadata ? JSON.stringify(event.metadata) : null;

    try {
      this.db
        .prepare(`
          INSERT INTO events (
            id, timestamp, operation, prompt, style, model,
            input_path, output_path, cost, processing_time, metadata
          ) VALUES (
            @id, @timestamp, @operation, @prompt, @style, @model,
            @input_path, @output_path, @cost, @processing_time, @metadata
          )
        `)
        .run({
          id,
          timestamp,
          operation: event.operation,
          prompt: event.prompt ?? null,
          style: event.style ?? null,
          model: event.model ?? null,
          input_path: event.inputPath ?? null,
          output_path: event.outputPath ?? null,
          cost: event.cost,
          processing_time: event.processingTime ?? null,
          metadata,
        });
    } catch (error) {
      console.error('Failed to log analytics event', error);
    }
  }

  getMonthlySummary(month: string): MonthlySummary {
    const { start, end } = monthToRange(month);
    const totals = this.db
      .prepare(
        `SELECT COUNT(*) as totalEvents, COALESCE(SUM(cost), 0) as totalCost FROM events WHERE timestamp >= ? AND timestamp < ?`,
      )
      .get(start, end) as { totalEvents: number; totalCost: number } | undefined;

    const breakdownRows = this.db
      .prepare(
        `SELECT
            operation,
            COUNT(*) as count,
            COALESCE(SUM(cost), 0) as totalCost,
            COALESCE(AVG(cost), 0) as averageCost,
            COALESCE(AVG(processing_time), 0) as averageProcessingTime
          FROM events
          WHERE timestamp >= ? AND timestamp < ?
          GROUP BY operation
        `,
      )
      .all(start, end) as Array<{
      operation: string;
      count: number;
      totalCost: number;
      averageCost: number;
      averageProcessingTime: number;
    }>;

    const byOperation: OperationBreakdown[] = breakdownRows.map((row) => ({
      operation: row.operation,
      count: row.count,
      totalCost: row.totalCost,
      averageCost: row.averageCost,
      averageProcessingTime: row.averageProcessingTime,
    }));

    return {
      month,
      totalCost: totals?.totalCost ?? 0,
      totalEvents: totals?.totalEvents ?? 0,
      byOperation,
    };
  }

  getEventsForMonth(month: string): AnalyticsEvent[] {
    const { start, end } = monthToRange(month);
    const rows = this.db
      .prepare(`SELECT * FROM events WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC`)
      .all(start, end);
    return rows.map(parseRow);
  }

  exportMonthlyCsv(month: string, outputPath: string): void {
    const events = this.getEventsForMonth(month);
    const header = [
      'id',
      'timestamp',
      'operation',
      'prompt',
      'style',
      'model',
      'inputPath',
      'outputPath',
      'cost',
      'processingTime',
      'metadata',
    ];
    const rows = events.map((event) =>
      [
        event.id,
        event.timestamp,
        event.operation,
        event.prompt ?? '',
        event.style ?? '',
        event.model ?? '',
        event.inputPath ?? '',
        event.outputPath ?? '',
        event.cost.toFixed(4),
        event.processingTime?.toFixed(2) ?? '',
        event.metadata ? JSON.stringify(event.metadata) : '',
      ]
        .map((value) => {
          if (value === undefined || value === null) {
            return '';
          }
          const str = String(value);
          return str.includes(',') || str.includes('\"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');

    fsp.mkdir(path.dirname(outputPath), { recursive: true })
      .then(() => fsp.writeFile(outputPath, csv, 'utf-8'))
      .catch((error) => {
        console.error('Failed to export analytics CSV', error);
      });
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      console.error('Failed to close analytics database', error);
    }
  }
}
