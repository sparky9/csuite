/**
 * Bookkeeping Assistant integration helpers.
 */

import { createRequire } from 'node:module';
import type { ResolvedBookkeepingConfig } from '../config/integration.js';

const require = createRequire(import.meta.url);

const loadModule = <T>(candidates: string[]): T | undefined => {
  for (const candidate of candidates) {
    try {
      return require(candidate) as T;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code && code !== 'MODULE_NOT_FOUND') {
        console.error('[image-studio] Failed loading module candidate', {
          module: candidate,
          error,
        });
      }
    }
  }
  return undefined;
};

type TrackExpenseModule = {
  handleTrackExpense: (
    params: Record<string, unknown>,
    userId?: string,
  ) => Promise<unknown>;
};

type BookkeepingDbModule = {
  initializeBookkeepingDb: (connectionString: string) => Promise<boolean>;
};

const bookkeepingToolModule = loadModule<TrackExpenseModule>([
  '../../../bookkeeping-assistant/dist/tools/track-expense.tool.js',
  '../../../bookkeeping-assistant/src/tools/track-expense.tool.js',
]);

const bookkeepingDbModule = loadModule<BookkeepingDbModule>([
  '../../../bookkeeping-assistant/dist/db/client.js',
  '../../../bookkeeping-assistant/src/db/client.js',
]);

const handleTrackExpense = bookkeepingToolModule?.handleTrackExpense;
const initializeBookkeepingDb = bookkeepingDbModule?.initializeBookkeepingDb;

interface BookkeepingExpensePayload {
  amount: number;
  description: string;
  category?: string;
  notes?: string;
  date?: string;
  currency?: string;
  userId?: string;
  receiptUrl?: string;
}

export interface BookkeepingExpenseResult {
  expenseId?: string;
  transactionId?: string;
  category?: string;
  amount: number;
  currency?: string;
}

let bookkeepingInitPromise: Promise<boolean> | null = null;

const ensureBookkeepingReady = async (databaseUrl?: string): Promise<boolean> => {
  if (bookkeepingInitPromise) {
    return bookkeepingInitPromise;
  }

  if (!databaseUrl) {
    console.warn('[image-studio] Bookkeeping integration skipped: no database URL configured.');
    return false;
  }

  if (!initializeBookkeepingDb) {
    console.warn('[image-studio] Bookkeeping integration unavailable: database client module not found.');
    return false;
  }

  bookkeepingInitPromise = initializeBookkeepingDb(databaseUrl)
    .then((connected) => {
      if (!connected) {
        console.warn('[image-studio] Bookkeeping integration unavailable: database connection failed.');
      }
      return connected;
    })
    .catch((error) => {
      console.error('[image-studio] Failed to initialise bookkeeping database', error);
      bookkeepingInitPromise = null;
      return false;
    });

  return bookkeepingInitPromise;
};

const parseResult = (response: unknown): BookkeepingExpenseResult | undefined => {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const content = Array.isArray((response as any).content)
    ? (response as any).content
    : [];
  const first = content[0];
  if (!first || typeof first !== 'object' || typeof first.text !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(first.text) as any;
    if (!parsed?.success) {
      return undefined;
    }
    const expenseMeta = parsed.expense?.metadata ?? {};
    const transactionMeta = parsed.transaction?.metadata ?? {};
    const amountValue = parsed.expense?.amount ?? parsed.metadata?.amount;
    const currencyValue = parsed.expense?.currency ?? parsed.metadata?.currency;
    return {
      expenseId: expenseMeta.database_id ?? parsed.expense?.id,
      transactionId: transactionMeta.database_id ?? parsed.transaction?.id,
      category: parsed.expense?.category,
      amount: typeof amountValue === 'number' ? amountValue : 0,
      currency: typeof currencyValue === 'string' ? currencyValue : undefined,
    } satisfies BookkeepingExpenseResult;
  } catch (error) {
    console.error('[image-studio] Failed to parse bookkeeping response', error);
    return undefined;
  }
};

export const recordBookkeepingExpense = async (
  config: ResolvedBookkeepingConfig,
  payload: BookkeepingExpensePayload,
): Promise<BookkeepingExpenseResult | undefined> => {
  if (!config.enabled) {
    return undefined;
  }

  if (!handleTrackExpense) {
    console.warn('[image-studio] Bookkeeping integration skipped: track-expense module not available.');
    return undefined;
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    console.warn('[image-studio] Bookkeeping integration skipped: amount must be greater than zero.');
    return undefined;
  }

  const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL;
  const connected = await ensureBookkeepingReady(databaseUrl ?? undefined);
  if (!connected) {
    return undefined;
  }

  const amount = Number(payload.amount.toFixed(4));
  const category = payload.category ?? config.category ?? 'marketing';
  const currency = payload.currency ?? config.currency ?? 'USD';
  const date = payload.date ?? new Date().toISOString().slice(0, 10);
  const userId = payload.userId ?? config.userId;
  const notes = [config.notes, payload.notes].filter(Boolean).join(' | ') || undefined;

  try {
    const response = await handleTrackExpense(
      {
        amount,
        description: payload.description,
        category,
        date,
        notes,
        currency,
        user_id: userId,
        receipt_url: payload.receiptUrl,
      },
      userId,
    );

    if ((response as any)?.isError) {
      console.error('[image-studio] Bookkeeping integration returned an error response');
      return undefined;
    }

    const result = parseResult(response);
    if (result) {
      result.amount = Number.isFinite(result.amount) ? (result.amount as number) : amount;
      result.currency = result.currency ?? currency;
      result.category = result.category ?? category;
    }
    return result;
  } catch (error) {
    console.error('[image-studio] Failed to record bookkeeping expense', error);
    return undefined;
  }
};
