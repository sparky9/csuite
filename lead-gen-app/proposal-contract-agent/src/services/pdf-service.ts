import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument, rgb, StandardFonts } from 'pdf-lib';
import MarkdownIt from 'markdown-it';
import { getDbPool, withTransaction } from '../db/client.js';
import type { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const md = new MarkdownIt();

interface PdfGenerationOptions {
  contractId: string;
  contractNumber: string;
  contractBody: string;
  clientName: string;
  includeSignatureField?: boolean;
  signaturePositions?: Array<{ page: number; x: number; y: number }>;
}

interface PdfStorageResult {
  documentId: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  storageType: 'database';
}

/**
 * PDF Generation Service
 * Converts markdown contracts to signable PDFs using PDFKit and pdf-lib
 */
export class PdfService {
  /**
   * Generate a PDF from markdown contract body
   * Uses PDFKit for initial generation, then pdf-lib for signature field addition
   */
  async generateContractPdf(options: PdfGenerationOptions): Promise<Buffer> {
    try {
      logger.info('Generating PDF for contract', { contractId: options.contractId });

      // Step 1: Generate base PDF from markdown using PDFKit
      const basePdf = await this.markdownToPdf(options.contractBody, {
        title: `Contract ${options.contractNumber}`,
        client: options.clientName,
      });

      // Step 2: Add signature fields if requested
      if (options.includeSignatureField) {
        const signablePdf = await this.addSignatureFields(basePdf, options.signaturePositions);
        return signablePdf;
      }

      return basePdf;
    } catch (error: any) {
      logger.error('Failed to generate contract PDF', { error: error.message, contractId: options.contractId });
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Convert markdown text to PDF using PDFKit
   */
  private async markdownToPdf(markdown: string, metadata: { title: string; client: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 72, bottom: 72, left: 72, right: 72 },
          info: {
            Title: metadata.title,
            Author: 'Proposal & Contract Agent',
            Subject: `Contract for ${metadata.client}`,
            Creator: 'MCP Contract Generator',
            Producer: 'PDFKit',
          },
        });

        // Capture PDF chunks
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Parse markdown and render to PDF
        this.renderMarkdownToPdf(doc, markdown);

        // Add footer with generation timestamp
        const pageCount = (doc as any).bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.fontSize(8)
            .fillColor('#666666')
            .text(
              `Generated: ${new Date().toISOString().split('T')[0]} | Page ${i + 1} of ${pageCount}`,
              72,
              doc.page.height - 50,
              { align: 'center', width: doc.page.width - 144 }
            );
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Render parsed markdown content to PDF document
   */
  private renderMarkdownToPdf(doc: PDFKit.PDFDocument, markdown: string): void {
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) {
        doc.fontSize(10).font('Courier').fillColor('#333333').text(line, { indent: 20 });
        continue;
      }

      // Handle headings
      if (line.startsWith('# ')) {
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#000000').text(line.slice(2), { paragraphGap: 10 });
      } else if (line.startsWith('## ')) {
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text(line.slice(3), { paragraphGap: 8 });
      } else if (line.startsWith('### ')) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text(line.slice(4), { paragraphGap: 6 });
      }
      // Handle bold/italic markdown inline (simplified)
      else if (line.startsWith('**') || line.includes('**')) {
        const cleanLine = line.replace(/\*\*/g, '');
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(cleanLine, { paragraphGap: 5 });
      }
      // Handle lists
      else if (line.match(/^[\-\*]\s/)) {
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor('#333333')
          .text(`• ${line.slice(2)}`, { indent: 20, paragraphGap: 3 });
      }
      // Handle tables (simplified)
      else if (line.startsWith('|')) {
        if (!inTable) {
          inTable = true;
          doc.moveDown(0.5);
        }
        const cells = line
          .split('|')
          .filter((c) => c.trim())
          .map((c) => c.trim());
        // Skip separator lines
        if (cells.every((c) => c.match(/^[\-:]+$/))) continue;
        doc.fontSize(10).font('Courier').fillColor('#333333').text(cells.join(' | '), { paragraphGap: 2 });
      } else {
        inTable = false;
        // Regular paragraph
        if (line.trim()) {
          doc.fontSize(11).font('Helvetica').fillColor('#333333').text(line, { align: 'left', paragraphGap: 5 });
        } else {
          doc.moveDown(0.5);
        }
      }
    }
  }

  /**
   * Add signature fields to PDF using pdf-lib
   */
  private async addSignatureFields(
    pdfBuffer: Buffer,
    positions?: Array<{ page: number; x: number; y: number }>
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFLibDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      // Default signature positions if not provided
      const defaultPositions = [
        { page: pages.length - 1, x: 100, y: 150 }, // Client signature
        { page: pages.length - 1, x: 350, y: 150 }, // Provider signature
      ];

      const sigPositions = positions || defaultPositions;

      // Add signature placeholders (visual indicators)
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const pos of sigPositions) {
        if (pos.page >= 0 && pos.page < pages.length) {
          const page = pages[pos.page];
          const pageHeight = page.getHeight();

          // Draw signature line
          page.drawLine({
            start: { x: pos.x, y: pageHeight - pos.y },
            end: { x: pos.x + 200, y: pageHeight - pos.y },
            thickness: 1,
            color: rgb(0, 0, 0),
          });

          // Add "Signature" label
          page.drawText('Signature:', {
            x: pos.x,
            y: pageHeight - pos.y - 20,
            size: 10,
            font: helveticaFont,
            color: rgb(0.3, 0.3, 0.3),
          });

          // Add "Date" field
          page.drawLine({
            start: { x: pos.x, y: pageHeight - pos.y - 40 },
            end: { x: pos.x + 100, y: pageHeight - pos.y - 40 },
            thickness: 1,
            color: rgb(0, 0, 0),
          });

          page.drawText('Date:', {
            x: pos.x,
            y: pageHeight - pos.y - 60,
            size: 10,
            font: helveticaFont,
            color: rgb(0.3, 0.3, 0.3),
          });
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      return Buffer.from(modifiedPdfBytes);
    } catch (error: any) {
      logger.error('Failed to add signature fields to PDF', { error: error.message });
      throw new Error(`Signature field addition failed: ${error.message}`);
    }
  }

  /**
   * Embed a signature image into the PDF at specified position
   */
  async embedSignature(
    pdfBuffer: Buffer,
    signatureImageBase64: string,
    position: { page: number; x: number; y: number; width?: number; height?: number }
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFLibDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      if (position.page < 0 || position.page >= pages.length) {
        throw new Error(`Invalid page number: ${position.page}`);
      }

      const page = pages[position.page];
      const pageHeight = page.getHeight();

      // Detect image format and embed
      let image;
      const imageData = signatureImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(imageData, 'base64');

      if (signatureImageBase64.includes('image/png') || signatureImageBase64.includes('PNG')) {
        image = await pdfDoc.embedPng(imageBuffer);
      } else if (signatureImageBase64.includes('image/jpeg') || signatureImageBase64.includes('JPG')) {
        image = await pdfDoc.embedJpg(imageBuffer);
      } else {
        // Default to PNG
        image = await pdfDoc.embedPng(imageBuffer);
      }

      const imageDims = image.scale(0.5);
      const width = position.width || imageDims.width;
      const height = position.height || imageDims.height;

      page.drawImage(image, {
        x: position.x,
        y: pageHeight - position.y - height,
        width,
        height,
      });

      // Add timestamp
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(`Signed: ${new Date().toISOString().split('T')[0]}`, {
        x: position.x,
        y: pageHeight - position.y - height - 15,
        size: 8,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      const signedPdfBytes = await pdfDoc.save();
      return Buffer.from(signedPdfBytes);
    } catch (error: any) {
      logger.error('Failed to embed signature in PDF', { error: error.message });
      throw new Error(`Signature embedding failed: ${error.message}`);
    }
  }

  /**
   * Store PDF in database with integrity checksum
   */
  async storePdf(
    contractId: string,
    pdfBuffer: Buffer,
    fileName: string,
    executor?: Pool | PoolClient
  ): Promise<PdfStorageResult> {
    const db = executor ?? getDbPool();

    try {
      // Calculate SHA-256 checksum
      const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      const result = await db.query(
        `INSERT INTO contract_documents (
          contract_id,
          document_type,
          storage_type,
          file_name,
          file_size_bytes,
          mime_type,
          content_data,
          checksum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          contractId,
          'pdf',
          'database',
          fileName,
          pdfBuffer.length,
          'application/pdf',
          pdfBuffer,
          checksum,
        ]
      );

      const documentId = result.rows[0].id as string;

      logger.info('PDF stored in database', { contractId, documentId, fileSize: pdfBuffer.length });

      return {
        documentId,
        fileName,
        fileSize: pdfBuffer.length,
        checksum,
        storageType: 'database',
      };
    } catch (error: any) {
      logger.error('Failed to store PDF in database', { error: error.message, contractId });
      throw new Error(`PDF storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve PDF from database by contract ID
   */
  async getPdfByContractId(contractId: string): Promise<{ buffer: Buffer; fileName: string; checksum: string } | null> {
    const db = getDbPool();

    try {
      const result = await db.query(
        `SELECT content_data, file_name, checksum
         FROM contract_documents
         WHERE contract_id = $1 AND document_type = 'pdf'
         ORDER BY created_at DESC
         LIMIT 1`,
        [contractId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        buffer: Buffer.isBuffer(row.content_data) ? row.content_data : Buffer.from(row.content_data),
        fileName: row.file_name,
        checksum: row.checksum,
      };
    } catch (error: any) {
      logger.error('Failed to retrieve PDF from database', { error: error.message, contractId });
      throw new Error(`PDF retrieval failed: ${error.message}`);
    }
  }

  /**
   * Verify PDF integrity using checksum
   */
  verifyPdfIntegrity(pdfBuffer: Buffer, expectedChecksum: string): boolean {
    const actualChecksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    return actualChecksum === expectedChecksum;
  }
}

export const pdfService = new PdfService();
