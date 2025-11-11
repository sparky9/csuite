import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function ensureFileExists(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`${filePath} is not a file`);
    }
  } catch (error: any) {
    throw new Error(`File not found: ${filePath} (${error.message})`);
  }
}

export async function ensureDirectory(pathToCheck: string): Promise<void> {
  try {
    await fs.mkdir(pathToCheck, { recursive: true });
  } catch (error: any) {
    throw new Error(`Cannot create directory ${pathToCheck}: ${error.message}`);
  }
}

export function buildOutputPath(
  outputFolder: string,
  inputPath: string,
  suffix: string,
): string {
  const ext = path.extname(inputPath);
  const name = path.basename(inputPath, ext);
  return path.join(outputFolder, `${name}_${suffix}${ext}`);
}
