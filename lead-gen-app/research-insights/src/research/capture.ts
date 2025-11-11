import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { logger } from '../utils/logger.js';
import type { CaptureResult } from './types.js';

interface CaptureOptions {
  selector?: string;
  timeoutMs?: number;
}

async function tryPlaywrightCapture(url: string, options: CaptureOptions): Promise<CaptureResult | null> {
  try {
    const playwright = await import('playwright');
    const env = (globalThis as any)?.process?.env ?? {};
    const browserType = env.RESEARCH_BROWSER ?? 'chromium';
    const timeout = options.timeoutMs ?? 20000;

    const browser = await (playwright as any)[browserType].launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const start = performance.now();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    if (!response) {
      throw new Error('No response from page');
    }

    if (response.status() >= 400) {
      throw new Error(`Non-success status: ${response.status()}`);
    }

    if (options.selector) {
      await page.waitForSelector(options.selector, { timeout: timeout / 2 }).catch(() => null);
    }

    const html = await page.content();
    const title = await page.title();
    const text = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      return doc?.body?.innerText ?? '';
    });
    const loadTimeMs = Math.round(performance.now() - start);

    await browser.close();

    return {
      url,
      html,
      text,
      title,
      metadata: {
        loadTimeMs,
        status: response.status(),
        contentLength: html.length
      }
    };
  } catch (error) {
    logger.warn('Playwright capture failed, falling back to fetch', {
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function fetchFallback(url: string): Promise<CaptureResult> {
  const start = performance.now();
  const response = await fetch(url, { headers: { 'User-Agent': 'Research-Insights/1.0' } });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const html = await response.text();
  const text = stripHtml(html).slice(0, 20000);

  return {
    url,
    html,
    text,
    metadata: {
      loadTimeMs: Math.round(performance.now() - start),
      status: response.status,
      contentLength: html.length
    }
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function captureSource(url: string, options: CaptureOptions = {}): Promise<CaptureResult> {
  const playwrightResult = await tryPlaywrightCapture(url, options);
  if (playwrightResult) {
    return playwrightResult;
  }

  return await fetchFallback(url);
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
