import { getDbPool, withTransaction } from '../db/client.js';
import type { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

interface SigningToken {
  id: string;
  contractId: string;
  contactId: string;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

interface SignatureCapture {
  contactId: string;
  signatureType: 'typed' | 'drawn' | 'uploaded';
  signatureData: string; // base64 encoded image or text
  signatureFormat?: 'png' | 'svg' | 'text';
  fontFamily?: string;
  width?: number;
  height?: number;
  ipAddress?: string;
  userAgent?: string;
}

interface VerificationCode {
  code: string;
  expiresAt: Date;
}

interface SignatureStatus {
  contractId: string;
  totalSigners: number;
  signedCount: number;
  pendingSigners: Array<{
    contactId: string;
    fullName: string;
    email: string;
    role: string;
    hasToken: boolean;
    tokenExpired: boolean;
    signedAt: string | null;
  }>;
  isFullySigned: boolean;
}

/**
 * Signature Service
 * Handles signature token generation, verification, and signature capture
 */
export class SignatureService {
  /**
   * Generate a unique signing token for a contact
   * Token is cryptographically secure and URL-safe
   */
  async generateSigningToken(
    contractId: string,
    contactId: string,
    expirationDays: number = 30
  ): Promise<{ token: string; signingUrl: string; expiresAt: Date }> {
    return withTransaction(async (client) => {
      try {
        // Generate cryptographically secure token
        const token = crypto.randomBytes(32).toString('base64url'); // URL-safe base64
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);

        // Store token in database
        await client.query(
          `INSERT INTO signature_tokens (contract_id, contact_id, token, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [contractId, contactId, token, expiresAt]
        );

        // Log event
        await client.query(
          `INSERT INTO signature_audit_log (contract_id, contact_id, event_type, event_data)
           VALUES ($1, $2, 'link_generated', jsonb_build_object('expires_at', $3::text))`,
          [contractId, contactId, expiresAt.toISOString()]
        );

        logger.info('Signing token generated', { contractId, contactId, expiresAt });

        // Generate signing URL (would be your app's URL in production)
        const signingUrl = `https://yourapp.com/sign/${token}`;

        return { token, signingUrl, expiresAt };
      } catch (error: any) {
        logger.error('Failed to generate signing token', { error: error.message, contractId, contactId });
        throw new Error(`Token generation failed: ${error.message}`);
      }
    });
  }

  /**
   * Validate a signing token
   * Checks if token exists, is not expired, and not already used
   */
  async validateToken(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ valid: boolean; contractId?: string; contactId?: string; reason?: string }> {
    const db = getDbPool();

    try {
      const result = await db.query(
        `SELECT id, contract_id, contact_id, expires_at, is_used, accessed_at
         FROM signature_tokens
         WHERE token = $1
         LIMIT 1`,
        [token]
      );

      if (result.rows.length === 0) {
        return { valid: false, reason: 'Token not found' };
      }

      const tokenData = result.rows[0];
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);

      if (tokenData.is_used) {
        return { valid: false, reason: 'Token already used' };
      }

      if (now > expiresAt) {
        return { valid: false, reason: 'Token expired' };
      }

      // Update access tracking
      await db.query(
        `UPDATE signature_tokens
         SET accessed_at = NOW(), ip_address = $2, user_agent = $3
         WHERE id = $1`,
        [tokenData.id, ipAddress, userAgent]
      );

      // Log access event
      await db.query(
        `INSERT INTO signature_audit_log (contract_id, contact_id, token_id, event_type, event_data, ip_address, user_agent)
         VALUES ($1, $2, $3, 'link_accessed', jsonb_build_object('timestamp', $4::text), $5, $6)`,
        [tokenData.contract_id, tokenData.contact_id, tokenData.id, now.toISOString(), ipAddress, userAgent]
      );

      logger.info('Token validated successfully', {
        token: token.substring(0, 10) + '...',
        contractId: tokenData.contract_id,
      });

      return {
        valid: true,
        contractId: tokenData.contract_id,
        contactId: tokenData.contact_id,
      };
    } catch (error: any) {
      logger.error('Token validation failed', { error: error.message });
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Generate email verification code for signer authentication
   */
  async generateVerificationCode(contactId: string, expirationMinutes: number = 15): Promise<VerificationCode> {
    const db = getDbPool();

    try {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

      await db.query(
        `INSERT INTO signature_verifications (contact_id, verification_code, expires_at)
         VALUES ($1, $2, $3)`,
        [contactId, code, expiresAt]
      );

      logger.info('Verification code generated', { contactId });

      return { code, expiresAt };
    } catch (error: any) {
      logger.error('Failed to generate verification code', { error: error.message, contactId });
      throw new Error(`Verification code generation failed: ${error.message}`);
    }
  }

  /**
   * Verify email verification code
   */
  async verifyCode(
    contactId: string,
    code: string
  ): Promise<{ verified: boolean; reason?: string; verificationId?: string }> {
    const db = getDbPool();

    try {
      const result = await db.query(
        `SELECT id, expires_at, is_verified, attempts
         FROM signature_verifications
         WHERE contact_id = $1 AND verification_code = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [contactId, code]
      );

      if (result.rows.length === 0) {
        return { verified: false, reason: 'Invalid verification code' };
      }

      const verification = result.rows[0];
      const now = new Date();
      const expiresAt = new Date(verification.expires_at);

      // Check if already verified
      if (verification.is_verified) {
        return { verified: true, verificationId: verification.id };
      }

      // Check expiration
      if (now > expiresAt) {
        return { verified: false, reason: 'Verification code expired' };
      }

      // Check attempts (max 3)
      if (verification.attempts >= 3) {
        return { verified: false, reason: 'Too many attempts' };
      }

      // Mark as verified
      await db.query(
        `UPDATE signature_verifications
         SET is_verified = TRUE, verified_at = NOW()
         WHERE id = $1`,
        [verification.id]
      );

      logger.info('Verification code validated', { contactId });

      return { verified: true, verificationId: verification.id };
    } catch (error: any) {
      logger.error('Code verification failed', { error: error.message, contactId });
      throw new Error(`Code verification failed: ${error.message}`);
    }
  }

  /**
   * Capture and store signature data
   */
  async captureSignature(signature: SignatureCapture): Promise<{ signatureId: string; timestamp: Date }> {
    return withTransaction(async (client) => {
      try {
        const timestamp = new Date();

        const result = await client.query(
          `INSERT INTO signature_data (
            contact_id,
            signature_type,
            signature_format,
            signature_data,
            font_family,
            width,
            height,
            ip_address,
            user_agent,
            timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            signature.contactId,
            signature.signatureType,
            signature.signatureFormat || null,
            signature.signatureData,
            signature.fontFamily || null,
            signature.width || null,
            signature.height || null,
            signature.ipAddress || null,
            signature.userAgent || null,
            timestamp,
          ]
        );

        const signatureId = result.rows[0].id as string;

        // Update contact as signed
        await client.query(
          `UPDATE signature_contacts
           SET signed_at = $2, updated_at = NOW()
           WHERE id = $1`,
          [signature.contactId, timestamp]
        );

        // Get contract_id from contact
        const contactResult = await client.query(`SELECT contract_id FROM signature_contacts WHERE id = $1`, [
          signature.contactId,
        ]);
        if (contactResult.rows.length === 0) {
          throw new Error('Signature contact not found for provided contactId');
        }

        const contractId = contactResult.rows[0].contract_id;

        // Mark token as used
        await client.query(
          `UPDATE signature_tokens
           SET is_used = TRUE
           WHERE contact_id = $1 AND is_used = FALSE`,
          [signature.contactId]
        );

        // Log signature event
        await client.query(
          `INSERT INTO signature_audit_log (
            contract_id,
            contact_id,
            event_type,
            event_data,
            ip_address,
            user_agent
          ) VALUES ($1, $2, 'signature_completed', jsonb_build_object(
            'signature_id', $3::text,
            'signature_type', $4::text,
            'timestamp', $5::text
          ), $6, $7)`,
          [
            contractId,
            signature.contactId,
            signatureId,
            signature.signatureType,
            timestamp.toISOString(),
            signature.ipAddress,
            signature.userAgent,
          ]
        );

        // Check if all signers have signed
        const allSignedResult = await client.query(
          `SELECT COUNT(*) as total, COUNT(signed_at) as signed
           FROM signature_contacts
           WHERE contract_id = $1`,
          [contractId]
        );

        const { total, signed } = allSignedResult.rows[0];
        if (parseInt(total) === parseInt(signed)) {
          // All signed! Update contract status
          await client.query(
            `UPDATE contracts
             SET status = 'fully_signed', signed_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [contractId]
          );

          await client.query(
            `INSERT INTO signature_events (contract_id, event_type, description)
             VALUES ($1, 'fully_signed', 'All parties have signed the contract')`,
            [contractId]
          );

          logger.info('Contract fully signed', { contractId });
        }

        logger.info('Signature captured', { contractId, contactId: signature.contactId, signatureId });

        return { signatureId, timestamp };
      } catch (error: any) {
        logger.error('Failed to capture signature', { error: error.message, contactId: signature.contactId });
        throw new Error(`Signature capture failed: ${error.message}`);
      }
    });
  }

  /**
   * Get signature status for a contract
   */
  async getSignatureStatus(contractId: string): Promise<SignatureStatus> {
    const db = getDbPool();

    try {
      const contactsResult = await db.query(
        `SELECT
           sc.id as contact_id,
           sc.full_name,
           sc.email,
           sc.role,
           sc.signed_at,
           st.token,
           st.expires_at,
           st.is_used
         FROM signature_contacts sc
         LEFT JOIN signature_tokens st ON st.contact_id = sc.id
         WHERE sc.contract_id = $1
         ORDER BY sc.role ASC`,
        [contractId]
      );

      const totalSigners = contactsResult.rows.length;
      const signedCount = contactsResult.rows.filter((row) => row.signed_at !== null).length;

      const pendingSigners = contactsResult.rows.map((row) => ({
        contactId: row.contact_id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        hasToken: !!row.token,
        tokenExpired: row.expires_at ? new Date() > new Date(row.expires_at) : false,
        signedAt: row.signed_at ? new Date(row.signed_at).toISOString() : null,
      }));

      const isFullySigned = totalSigners > 0 && signedCount === totalSigners;

      return {
        contractId,
        totalSigners,
        signedCount,
        pendingSigners,
        isFullySigned,
      };
    } catch (error: any) {
      logger.error('Failed to get signature status', { error: error.message, contractId });
      throw new Error(`Signature status retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get signature data for a contact
   */
  async getSignatureData(
    contactId: string
  ): Promise<{ signatureData: string; signatureType: string; timestamp: Date } | null> {
    const db = getDbPool();

    try {
      const result = await db.query(
        `SELECT signature_type, signature_data, timestamp
         FROM signature_data
         WHERE contact_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [contactId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        signatureData: row.signature_data,
        signatureType: row.signature_type,
        timestamp: new Date(row.timestamp),
      };
    } catch (error: any) {
      logger.error('Failed to get signature data', { error: error.message, contactId });
      throw new Error(`Signature data retrieval failed: ${error.message}`);
    }
  }
}

export const signatureService = new SignatureService();
