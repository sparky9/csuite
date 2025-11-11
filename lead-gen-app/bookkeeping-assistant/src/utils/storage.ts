/**
 * File storage helpers used for generated artifacts (receipts, reports, etc.).
 */

import fs from 'fs';
import path from 'path';

export async function ensureDirectory(directory: string): Promise<void> {
  await fs.promises.mkdir(directory, { recursive: true });
}

export async function writeFileEnsured(filePath: string, data: Uint8Array | string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.promises.writeFile(filePath, data);
}

export function pathToFileUrl(filePath: string): string {
  const resolved = path.resolve(filePath);
  const normalized = resolved.replace(/\\/g, '/');
  return `file://${normalized}`;
}
