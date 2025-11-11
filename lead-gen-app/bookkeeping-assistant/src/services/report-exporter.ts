import path from 'path';
import { writeFileEnsured, ensureDirectory, pathToFileUrl } from '../utils/storage.js';
import type { ReportResult, ReportExportFormat } from '../types/bookkeeping.types.js';

const EXPORT_SUBDIR = path.join('data', 'report-exports');

interface ReportExportOptions {
  report: ReportResult;
  format: ReportExportFormat;
  userId?: string | null;
}

interface ReportExportPayload {
  reportId: string;
  filePath: string;
  downloadUrl: string;
  expiresAt: string;
  format: ReportExportFormat;
  bytesWritten: number;
  contentType: string;
}

const PDF_HEADER = 'BOOKKEEPING REPORT';

function uniqueId(): string {
  const randomPart = Math.random().toString(16).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `rpt-${timePart}-${randomPart}`;
}

function formatRecommendations(recommendations?: string[]): string {
  if (!recommendations || recommendations.length === 0) {
    return '';
  }
  return recommendations.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function buildCsv(report: ReportResult): string {
  const lines: string[] = [];
  lines.push('Metric,Value');
  for (const [key, value] of Object.entries(report.summary)) {
    lines.push(`${key},${value}`);
  }
  if (report.metrics) {
    lines.push('');
    lines.push('Metric Details');
    for (const [key, value] of Object.entries(report.metrics)) {
      lines.push(`${key},${value}`);
    }
  }
  if (report.recommendations?.length) {
    lines.push('');
    lines.push('Recommendations');
    report.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1},"${rec.replace(/"/g, '""')}"`);
    });
  }
  return lines.join('\n');
}

function buildSpreadsheetXml(report: ReportResult): string {
  const summaryRows = Object.entries(report.summary)
    .map(([key, value]) => `<Row><Cell><Data ss:Type="String">${key}</Data></Cell><Cell><Data ss:Type="Number">${value}</Data></Cell></Row>`) 
    .join('');

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${PDF_HEADER}</Title>
    <Author>Bookkeeping Assistant</Author>
  </DocumentProperties>
  <Worksheet ss:Name="Summary">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Metric</Data></Cell>
        <Cell><Data ss:Type="String">Value</Data></Cell>
      </Row>
      ${summaryRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function buildPdfPlaceholder(report: ReportResult): string {
  const summaryText = Object.entries(report.summary)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const recommendations = formatRecommendations(report.recommendations);

  return `${PDF_HEADER}\nType: ${report.type}\nPeriod: ${report.period}\nRange: ${report.start_date} to ${report.end_date}\n\nSummary\n${summaryText}\n\nRecommendations\n${recommendations || 'None'}\n`;
}

function determineExtension(format: ReportExportFormat): string {
  if (format === 'pdf') {
    return 'pdf';
  }
  if (format === 'excel') {
    return 'xml';
  }
  return 'csv';
}

function determineContentType(format: ReportExportFormat): string {
  if (format === 'pdf') {
    return 'application/pdf';
  }
  if (format === 'excel') {
    return 'application/vnd.ms-excel';
  }
  return 'text/csv';
}

async function writeContent(targetPath: string, format: ReportExportFormat, report: ReportResult): Promise<number> {
  let content: string;

  if (format === 'pdf') {
    content = buildPdfPlaceholder(report);
  } else if (format === 'excel') {
    content = buildSpreadsheetXml(report);
  } else {
    content = buildCsv(report);
  }

  const encoder = new TextEncoder();
  const encoded = encoder.encode(content);
  await writeFileEnsured(targetPath, encoded);
  return encoded.byteLength;
}

export async function exportReportArtifact(options: ReportExportOptions): Promise<ReportExportPayload> {
  const reportId = uniqueId();
  const extension = determineExtension(options.format);
  const fileName = `${reportId}.${extension}`;
  const exportDir = path.join(process.cwd(), EXPORT_SUBDIR, options.userId ?? 'public');
  await ensureDirectory(exportDir);
  const filePath = path.join(exportDir, fileName);
  const bytesWritten = await writeContent(filePath, options.format, options.report);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const downloadUrl = pathToFileUrl(filePath);

  return {
    reportId,
    filePath,
    downloadUrl,
    expiresAt,
    format: options.format,
    bytesWritten,
    contentType: determineContentType(options.format),
  };
}
