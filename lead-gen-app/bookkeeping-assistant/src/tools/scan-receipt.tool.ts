import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { analyzeReceiptImage } from '../services/receipt-ocr.js';
import { writeFileEnsured, pathToFileUrl } from '../utils/storage.js';
import { logger } from '../utils/logger.js';
import { createTransactionRecord } from '../ai/generator.js';
import { persistTransactionWithAudit } from '../utils/transactions.js';
import { bookkeepingDb } from '../db/client.js';
import type {
  ScanReceiptParams,
  ScanReceiptResult,
  AddTransactionParams,
  TransactionResult,
} from '../types/bookkeeping.types.js';

const RECEIPTS_SUBDIR = path.join('data', 'receipts');

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
}

function decodeBase64ToUint8Array(value: string): Uint8Array {
  const globalScope = globalThis as unknown as { Buffer?: { from(data: string, encoding: string): any } };
  if (globalScope.Buffer) {
    const buffer = globalScope.Buffer.from(value, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error('Base64 decoding not supported in this runtime environment.');
}

export const scanReceiptTool: Tool = {
  name: 'scan_receipt',
  description: `Upload a receipt image, run lightweight OCR, and optionally create an expense transaction.

Required parameters:
- userId: User identifier for routing the receipt
- imageBase64: Base64 string containing the receipt image data

Optional parameters:
- autoCreateTransaction: Defaults to true. When true, automatically records an expense based on OCR results.
- fileName: Suggested filename for storage
- mimeType: MIME type of the uploaded image (e.g., image/png)
- storeImage: Whether to persist binary data in the database (defaults true)

Returns a structured summary of the extracted data and whether a transaction was created.`,
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID (multi-tenant separation)' },
      imageBase64: { type: 'string', description: 'Base64 encoded image data' },
      autoCreateTransaction: { type: 'boolean', description: 'Automatically create a transaction (default true)' },
      fileName: { type: 'string', description: 'Optional filename (with extension)' },
      mimeType: { type: 'string', description: 'Image MIME type (default image/png)' },
      storeImage: { type: 'boolean', description: 'Persist binary image data in the database (default true)' },
    },
    required: ['userId', 'imageBase64'],
  },
};

export async function handleScanReceipt(args: unknown, fallbackUserId?: string) {
  const startTime = Date.now();

  try {
    const params = args as ScanReceiptParams;
    if (!params?.imageBase64) {
      throw new Error('imageBase64 parameter is required');
    }

    const userId = params.userId || fallbackUserId || 'anonymous';
    const autoCreate = params.autoCreateTransaction !== false;
    const storeImageBinary = params.storeImage !== false;
    const runtimeProcess = (globalThis as unknown as { process?: { cwd?: () => string } }).process;
    const baseDir = runtimeProcess?.cwd ? runtimeProcess.cwd() : '.';

    const imageBytes = decodeBase64ToUint8Array(params.imageBase64);
    const analysis = analyzeReceiptImage(params.imageBase64, userId);

    const defaultExtension = params.mimeType?.split('/')[1] ?? 'png';
    const defaultFileName = `${analysis.extracted.reference ?? 'receipt'}-${analysis.checksum.slice(0, 8)}.${defaultExtension}`;
    const sanitizedFileName = sanitizeFileName(params.fileName ?? defaultFileName);
    const receiptDirectory = path.join(baseDir, RECEIPTS_SUBDIR, userId);
    const filePath = path.join(receiptDirectory, sanitizedFileName);

    await writeFileEnsured(filePath, imageBytes);
    const imageUrl = pathToFileUrl(filePath);

    let transactionCreated = false;
    let transactionId: string | undefined;
    let transactionRecord: TransactionResult | undefined;
    let transactionDatabaseId: string | undefined;

    if (autoCreate) {
      const transactionParams: AddTransactionParams = {
        type: 'expense',
        amount: analysis.extracted.amount,
        description: `Receipt from ${analysis.extracted.vendor}`,
        category: analysis.extracted.category,
        date: analysis.extracted.date,
        reference: analysis.extracted.reference,
        user_id: userId,
        currency: analysis.extracted.currency,
        exchange_rate: analysis.extracted.exchangeRate,
      };

      const transaction = createTransactionRecord(transactionParams);
      const persistence = await persistTransactionWithAudit({
        transaction,
        params: transactionParams,
        userId,
        metadata: transaction.metadata ?? {},
        source: 'tool:scan_receipt',
      });

      transaction.metadata = {
        ...(transaction.metadata ?? {}),
        ...persistence.metadata,
        receipt_reference: analysis.extracted.reference,
        ...(persistence.databaseId ? { database_id: persistence.databaseId } : {}),
      };

      transactionCreated = true;
      transactionId = persistence.databaseId ?? transaction.id;
      transactionDatabaseId = persistence.databaseId;
      transactionRecord = transaction;
    }

    const nodeBuffer = (globalThis as unknown as { Buffer?: { from(data: Uint8Array): unknown } }).Buffer;
    const binaryPayload = storeImageBinary && nodeBuffer ? nodeBuffer.from(imageBytes) : null;

    let receiptId = `receipt-${analysis.checksum.slice(0, 12)}`;

    if (bookkeepingDb.connected) {
      const insert = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_receipt_attachments (transaction_id, user_id, file_name, file_size_bytes, mime_type, storage_url, image_data, checksum, ocr_data, ocr_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         RETURNING id`,
        [
          transactionDatabaseId ?? null,
          userId,
          sanitizedFileName,
          imageBytes.byteLength,
          params.mimeType ?? 'image/png',
          imageUrl,
          binaryPayload,
          analysis.checksum,
          JSON.stringify(analysis.extracted),
          analysis.confidence,
        ],
      );

      if (insert.rows[0]?.id) {
        receiptId = insert.rows[0].id;
        if (transactionRecord && transactionRecord.metadata) {
          transactionRecord.metadata.receipt_attachment_id = receiptId;
        }
      }
    }

    const payload: ScanReceiptResult = {
      receiptId,
      extracted: analysis.extracted,
      confidence: analysis.confidence,
      transactionCreated,
      transactionId,
      imageUrl,
      metadata: {
        checksum: analysis.checksum,
        filePath,
        fileSizeBytes: imageBytes.byteLength,
        storageUser: userId,
        transactionDatabaseId,
        transactionDeterministicId: transactionRecord?.id,
        autoCreated: autoCreate,
        baseAmountUsd: analysis.baseAmount,
        transaction: transactionRecord,
        baseCurrency: transactionRecord?.base_currency ?? 'USD',
      },
    };

    const duration = Date.now() - startTime;

    logger.info('Receipt processed successfully', {
      userId,
      receiptId: payload.receiptId,
      transactionCreated,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, receipt: payload }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('scan_receipt tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'scan_receipt',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
