import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { loadLedger } from '../utils/ledger.js';
import { buildFinancialReport } from '../ai/generator.js';
import { exportReportArtifact } from '../services/report-exporter.js';
import { bookkeepingDb } from '../db/client.js';
import type {
  ExportReportParams,
  ExportReportResult,
  ReportExportFormat,
  ReportType,
  GenerateReportParams,
} from '../types/bookkeeping.types.js';

const DEFAULT_FORMAT: ReportExportFormat = 'pdf';

const SUPPORTED_FORMATS: ReportExportFormat[] = ['pdf', 'excel', 'csv'];

function normalizeFormat(format?: string): ReportExportFormat {
  if (!format) {
    return DEFAULT_FORMAT;
  }
  const normalized = format.toLowerCase();
  if (SUPPORTED_FORMATS.includes(normalized as ReportExportFormat)) {
    return normalized as ReportExportFormat;
  }
  return DEFAULT_FORMAT;
}

function buildReportParams(params: ExportReportParams, userId?: string): GenerateReportParams {
  return {
    type: params.reportType as ReportType,
    period: 'monthly',
    start_date: params.startDate,
    end_date: params.endDate,
    include_details: true,
    user_id: userId,
  };
}

export const exportReportTool: Tool = {
  name: 'export_report',
  description: `Generate a financial report and export it as PDF, Excel (SpreadsheetML), or CSV.

Required parameters:
- userId: Target user for the export
- reportType: Report type (profit_loss | cash_flow | balance_sheet | tax_summary)
- startDate: Start date (YYYY-MM-DD)
- endDate: End date (YYYY-MM-DD)

Optional parameters:
- format: Export format (pdf | excel | csv). Defaults to pdf.`,
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID to scope ledger data' },
      reportType: {
        type: 'string',
        enum: ['profit_loss', 'cash_flow', 'balance_sheet', 'tax_summary'],
        description: 'Report type to generate',
      },
      startDate: { type: 'string', description: 'Report start date (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'Report end date (YYYY-MM-DD)' },
      format: {
        type: 'string',
        enum: ['pdf', 'excel', 'csv'],
        description: 'Export format (defaults to pdf)',
      },
    },
    required: ['userId', 'reportType', 'startDate', 'endDate'],
  },
};

export async function handleExportReport(args: unknown) {
  const startTime = Date.now();

  try {
    const params = args as ExportReportParams;
    const userId = params.userId;

    logger.info('Exporting financial report', {
      userId,
      reportType: params.reportType,
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format ?? DEFAULT_FORMAT,
    });

    const ledger = await loadLedger({
      userId,
      startDate: params.startDate,
      endDate: params.endDate,
      fallbackSeed: `${params.reportType}:${params.startDate}:${params.endDate}`,
      fallbackMonths: 6,
    });

    const reportParams = buildReportParams(params, userId);
    const report = buildFinancialReport(reportParams, ledger);

    const format = normalizeFormat(params.format);
    const artifact = await exportReportArtifact({
      report,
      format,
      userId,
    });

    if (bookkeepingDb.connected) {
      await bookkeepingDb.query(
        `INSERT INTO bk_report_exports (user_id, report_type, format, start_date, end_date, file_path, download_url, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          params.reportType,
          format,
          params.startDate,
          params.endDate,
          artifact.filePath,
          artifact.downloadUrl,
          artifact.expiresAt,
        ],
      );
    }

    const payload: ExportReportResult = {
      reportId: artifact.reportId,
      format,
      downloadUrl: artifact.downloadUrl,
      expiresAt: artifact.expiresAt,
      filePath: artifact.filePath,
      metadata: {
        contentType: artifact.contentType,
        bytesWritten: artifact.bytesWritten,
        reportSummary: report.summary,
        baseCurrency: (report.metadata as { base_currency?: string } | undefined)?.base_currency ?? 'USD',
      },
    };

    const duration = Date.now() - startTime;
    logger.info('Report export generated', {
      userId,
      reportType: params.reportType,
      format,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, export: payload }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('export_report tool failed', {
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
              tool: 'export_report',
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
