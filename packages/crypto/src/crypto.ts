import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Error thrown when decryption fails due to authentication failure.
 * This indicates the ciphertext was tampered with or corrupted.
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when decryption fails due to invalid ciphertext format.
 */
export class InvalidCiphertextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCiphertextError';
  }
}

/**
 * Encrypts plaintext using AES-256-GCM authenticated encryption.
 *
 * AES-256-GCM provides both confidentiality and authenticity:
 * - Confidentiality: Data is encrypted and cannot be read without the key
 * - Authenticity: Any tampering with the ciphertext will be detected during decryption
 *
 * The output format is: IV (12 bytes) | AuthTag (16 bytes) | Ciphertext (variable)
 * Everything is encoded as base64 for safe storage in databases.
 *
 * Security Properties:
 * - Each encryption uses a unique random IV (initialization vector)
 * - The authentication tag prevents tampering and chosen-ciphertext attacks
 * - IVs MUST never be reused with the same key (we use random IVs to prevent this)
 *
 * @param plaintext - The data to encrypt (UTF-8 string)
 * @param key - The 32-byte encryption key (from deriveKey)
 * @returns Base64-encoded string containing IV, auth tag, and ciphertext
 *
 * @throws {Error} If key is not 32 bytes
 * @throws {Error} If plaintext is empty
 * @throws {Error} If encryption fails
 *
 * @example
 * ```typescript
 * const key = deriveKey(masterKey, 'tenant-123', 'connector-tokens');
 * const encrypted = encrypt('sensitive data', key);
 * // Store encrypted in database
 * ```
 */
export function encrypt(plaintext: string, key: Buffer): string {
  // Input validation
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Plaintext must not be empty');
  }

  if (!Buffer.isBuffer(key)) {
    throw new Error('Key must be a Buffer');
  }

  if (key.length !== 32) {
    throw new Error('Key must be exactly 32 bytes for AES-256-GCM');
  }

  try {
    // Generate a random 12-byte IV (96 bits)
    // NIST recommends 96-bit IVs for GCM mode
    const iv = randomBytes(12);

    // Create cipher with AES-256-GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the plaintext
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    // Get the authentication tag (16 bytes / 128 bits)
    const authTag = cipher.getAuthTag();

    // Combine: IV | AuthTag | Ciphertext
    // This format allows us to extract components during decryption
    const combined = Buffer.concat([iv, authTag, encrypted]);

    // Return as base64 for safe storage in text fields
    return combined.toString('base64');
  } catch (error) {
    // Wrap crypto errors with more context
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Encryption failed: ${message}`);
  }
}

/**
 * Decrypts ciphertext encrypted with the encrypt() function.
 *
 * This function:
 * 1. Parses the base64 ciphertext to extract IV, auth tag, and encrypted data
 * 2. Verifies the authentication tag (detects tampering)
 * 3. Decrypts and returns the plaintext
 *
 * Security Properties:
 * - Automatically validates authenticity before returning data
 * - Throws AuthenticationError if ciphertext was tampered with
 * - Constant-time comparison of authentication tags (provided by Node.js crypto)
 *
 * @param ciphertext - Base64-encoded output from encrypt()
 * @param key - The same 32-byte key used for encryption
 * @returns The decrypted plaintext (UTF-8 string)
 *
 * @throws {InvalidCiphertextError} If ciphertext format is invalid
 * @throws {AuthenticationError} If authentication tag verification fails (tampering detected)
 * @throws {Error} If key is invalid or decryption fails
 *
 * @example
 * ```typescript
 * const key = deriveKey(masterKey, 'tenant-123', 'connector-tokens');
 * const plaintext = decrypt(encryptedData, key);
 * // Use plaintext immediately, never cache it!
 * ```
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  // Input validation
  if (!ciphertext || ciphertext.length === 0) {
    throw new InvalidCiphertextError('Ciphertext must not be empty');
  }

  if (!Buffer.isBuffer(key)) {
    throw new Error('Key must be a Buffer');
  }

  if (key.length !== 32) {
    throw new Error('Key must be exactly 32 bytes for AES-256-GCM');
  }

  try {
    // Decode from base64
    const combined = Buffer.from(ciphertext, 'base64');

    // Minimum length: 12 (IV) + 16 (AuthTag) + 1 (at least 1 byte ciphertext)
    if (combined.length < 29) {
      throw new InvalidCiphertextError(
        'Ciphertext too short - may be corrupted'
      );
    }

    // Extract components: IV (12 bytes) | AuthTag (16 bytes) | Ciphertext (rest)
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    // Create decipher with AES-256-GCM
    const decipher = createDecipheriv('aes-256-gcm', key, iv);

    // Set the authentication tag for verification
    decipher.setAuthTag(authTag);

    // Decrypt the ciphertext
    // If auth tag doesn't match, this will throw an error
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    // Convert back to UTF-8 string
    return decrypted.toString('utf8');
  } catch (error) {
    // Distinguish between authentication failures and other errors
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('Unsupported state') ||
      message.includes('auth') ||
      message.includes('tag')
    ) {
      throw new AuthenticationError(
        'Authentication failed - ciphertext may have been tampered with or wrong key used'
      );
    }

    if (error instanceof InvalidCiphertextError) {
      throw error;
    }

    throw new Error(`Decryption failed: ${message}`);
  }
}

/**
 * Securely wipes a Buffer by overwriting it with random data.
 *
 * Use this to ensure sensitive data (like decrypted plaintext or keys)
 * doesn't linger in memory longer than necessary.
 *
 * Note: This is a best-effort function. JavaScript doesn't guarantee
 * immediate memory release, but this reduces the window of exposure.
 *
 * @param buffer - The Buffer to wipe
 *
 * @example
 * ```typescript
 * const key = deriveKey(masterKey, tenantId, context);
 * try {
 *   const encrypted = encrypt(data, key);
 *   return encrypted;
 * } finally {
 *   wipeBuffer(key); // Clean up sensitive key material
 * }
 * ```
 */
export function wipeBuffer(buffer: Buffer): void {
  if (!Buffer.isBuffer(buffer)) {
    return;
  }

  // Overwrite with random data
  randomBytes(buffer.length).copy(buffer);

  // Then zero it out
  buffer.fill(0);
}
