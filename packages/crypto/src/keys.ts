import { createHmac, randomBytes } from 'crypto';

/**
 * Derives a tenant-specific encryption key using HKDF (HMAC-based Key Derivation Function).
 *
 * HKDF is a key derivation function that takes a source key material and derives one or more
 * cryptographically strong secret keys from it. This implementation uses HMAC-SHA256.
 *
 * The derivation process ensures that:
 * 1. Each tenant gets a unique encryption key derived from the master key
 * 2. Different contexts (e.g., "connector-tokens", "data-encryption") produce different keys
 * 3. The master key is never used directly for encryption
 * 4. Keys are deterministic - same inputs always produce the same key
 *
 * Security Notes:
 * - The masterKey MUST be retrieved from the MASTER_ENCRYPTION_KEY environment variable
 * - The master key should be at least 32 bytes (256 bits) of cryptographically random data
 * - NEVER log, cache, or expose derived keys
 * - Rotate the master key periodically using a key versioning scheme
 *
 * @param masterKey - The master encryption key (from MASTER_ENCRYPTION_KEY env var)
 * @param tenantId - The unique tenant identifier
 * @param context - The purpose/context for this key (e.g., "connector-tokens", "data-encryption")
 * @returns A 32-byte (256-bit) derived key suitable for AES-256-GCM encryption
 *
 * @throws {Error} If masterKey is empty or invalid
 * @throws {Error} If tenantId is empty
 * @throws {Error} If context is empty
 *
 * @example
 * ```typescript
 * const masterKey = process.env.MASTER_ENCRYPTION_KEY!;
 * const key = deriveKey(masterKey, 'tenant-123', 'connector-tokens');
 * // Use key for encryption/decryption
 * ```
 */
export function deriveKey(
  masterKey: string,
  tenantId: string,
  context: string
): Buffer {
  // Input validation
  if (!masterKey || masterKey.length === 0) {
    throw new Error('Master key must not be empty');
  }

  if (!tenantId || tenantId.length === 0) {
    throw new Error('Tenant ID must not be empty');
  }

  if (!context || context.length === 0) {
    throw new Error('Context must not be empty');
  }

  // HKDF-Extract: Extract a pseudorandom key (PRK) from the master key
  // Using a fixed salt for deterministic key derivation
  // In production, you could use a per-tenant salt stored securely
  const salt = Buffer.from('ocsuite-crypto-v1', 'utf8');
  const prk = createHmac('sha256', salt)
    .update(Buffer.from(masterKey, 'utf8'))
    .digest();

  // HKDF-Expand: Expand the PRK into the final key material
  // Info combines tenant ID and context to ensure unique keys
  const info = Buffer.from(`${tenantId}:${context}`, 'utf8');

  // For output length = 32 bytes (256 bits), we only need one iteration
  // T(1) = HMAC-Hash(PRK, T(0) | info | 0x01)
  // where T(0) is empty string for first iteration
  const okm = createHmac('sha256', prk)
    .update(info)
    .update(Buffer.from([0x01]))
    .digest();

  // Return first 32 bytes (full output of SHA256) for AES-256-GCM
  return okm.subarray(0, 32);
}

/**
 * Generates a cryptographically secure random master key.
 *
 * This function should be used ONLY for initial key generation during system setup.
 * The generated key should be stored securely (e.g., in a secrets manager) and
 * set as the MASTER_ENCRYPTION_KEY environment variable.
 *
 * @returns A hex-encoded 256-bit (32-byte) random key
 *
 * @example
 * ```typescript
 * // Run this ONCE during initial setup
 * const masterKey = generateMasterKey();
 * console.log('Set MASTER_ENCRYPTION_KEY to:', masterKey);
 * // Store this value securely and never log it again!
 * ```
 */
export function generateMasterKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validates that a master key meets minimum security requirements.
 *
 * @param masterKey - The master key to validate
 * @returns true if valid, false otherwise
 */
export function isValidMasterKey(masterKey: string): boolean {
  if (!masterKey || typeof masterKey !== 'string') {
    return false;
  }

  // Master key should be at least 32 characters (128 bits minimum)
  // Recommended: 64 hex characters (256 bits) or longer
  if (masterKey.length < 32) {
    return false;
  }

  // Check for obvious weak keys
  const weakPatterns = [
    'test',
    'demo',
    'example',
    'password',
    '12345',
    'secret'
  ];

  const lowerKey = masterKey.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerKey.includes(pattern)) {
      return false;
    }
  }

  return true;
}
