import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface RevisionRecordInput {
  operation: string;
  outputPath: string;
  inputPath?: string;
  prompt?: string;
  style?: string;
  comparisonPath?: string;
  webVariants?: string[];
  replicateUrl?: string;
  cost: number;
  processingTime: number;
  metadata?: Record<string, unknown>;
}

export interface RevisionRecord extends RevisionRecordInput {
  id: string;
  timestamp: string;
}

export interface RevisionIndexEntry {
  id: string;
  timestamp: string;
  operation: string;
  outputPath: string;
  inputPath?: string;
  comparisonPath?: string;
  webVariants?: string[];
  metadata?: Record<string, unknown>;
}

export class RevisionStore {
  private root: string;

  constructor(revisionDirectory: string) {
    this.root = path.resolve(revisionDirectory);
  }

  async record(record: RevisionRecordInput & { id?: string; timestamp?: string }): Promise<string> {
    const id = record.id ?? randomUUID();
    const timestamp = record.timestamp ?? new Date().toISOString();
    const entry: RevisionRecord = {
      id,
      timestamp,
      operation: record.operation,
      outputPath: record.outputPath,
      inputPath: record.inputPath,
      prompt: record.prompt,
      style: record.style,
      comparisonPath: record.comparisonPath,
      webVariants: record.webVariants,
      replicateUrl: record.replicateUrl,
      cost: record.cost,
      processingTime: record.processingTime,
      metadata: record.metadata,
    };

    const destination = this.resolvePath(timestamp, id);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, JSON.stringify(entry, null, 2), 'utf-8');

    await this.appendIndex({
      id,
      timestamp,
      operation: entry.operation,
      outputPath: entry.outputPath,
      inputPath: entry.inputPath,
      comparisonPath: entry.comparisonPath,
      webVariants: entry.webVariants,
      metadata: entry.metadata,
    });

    return id;
  }

  async list(limit?: number): Promise<RevisionIndexEntry[]> {
    const entries = await this.readIndex();
    if (typeof limit === 'number' && limit >= 0) {
      return entries.slice(-limit).reverse();
    }
    return entries.reverse();
  }

  private resolvePath(timestamp: string, id: string): string {
    const date = new Date(timestamp);
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return path.join(this.root, year, month, `${id}.json`);
  }

  async get(id: string): Promise<RevisionRecord | undefined> {
    const records = await this.readIndex();
    const entry = records.find((item) => item.id === id);
    if (!entry) {
      return undefined;
    }
    const filePath = this.resolvePath(entry.timestamp, id);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as RevisionRecord;
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  private async appendIndex(entry: RevisionIndexEntry): Promise<void> {
    const indexPath = path.join(this.root, 'index.json');
    const records = await this.readIndex();
    const filtered = records.filter((item) => item.id !== entry.id);
    filtered.push(entry);
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(filtered, null, 2), 'utf-8');
  }

  private async readIndex(): Promise<RevisionIndexEntry[]> {
    const indexPath = path.join(this.root, 'index.json');
    try {
      const existing = await fs.readFile(indexPath, 'utf-8');
      const parsed = JSON.parse(existing);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as RevisionIndexEntry[];
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
