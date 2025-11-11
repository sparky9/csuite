/**
 * @ocsuite/crypto - Tenant-specific encryption using HKDF key derivation
 *
 * This package provides secure, tenant-isolated encryption for the Online C-Suite platform.
 * It uses HKDF (HMAC-based Key Derivation Function) to derive unique encryption keys for
 * each tenant from a single master key, ensuring data isolation between tenants.
 *
 * Key Features:
 * - Per-tenant key derivation from a single master key
 * - AES-256-GCM authenticated encryption (confidentiality + authenticity)
 * - Context-specific keys (e.g., different keys for tokens vs data)
 * - No external dependencies (uses Node.js built-in crypto)
 *
 * @packageDocumentation
 */

import { deriveKey, generateMasterKey, isValidMasterKey } from './keys.js';
import { encrypt, decrypt, wipeBuffer, AuthenticationError, InvalidCiphertextError } from './crypto.js';

// Re-export all core functions and types
export {
  // Key derivation
  deriveKey,
  generateMasterKey,
  isValidMasterKey,

  // Encryption/Decryption
  encrypt,
  decrypt,
  wipeBuffer,

  // Error types
  AuthenticationError,
  InvalidCiphertextError
};

export type CryptoInitializationConfig = {
  currentKey: string;
  currentKeyVersion: number;
  previousKeys?: Record<number | `${number}`, string>;
};

interface CryptoRegistry {
  currentVersion: number;
  keys: Map<number, string>;
}

/**
 * Configuration for the crypto package.
 * Should be initialized once at application startup.
 */
let registry: CryptoRegistry | null = null;

const INVALID_KEY_ERROR =
  'Invalid master encryption key. Key must be at least 32 characters and not contain weak patterns.';

function isRotationConfig(input: unknown): input is CryptoInitializationConfig {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const candidate = input as Record<string, unknown>;
  return typeof candidate.currentKey === 'string' && typeof candidate.currentKeyVersion === 'number';
}

function assertRegistry(): CryptoRegistry {
  if (!registry) {
    throw new Error(
      'Crypto package not initialized. Call initializeCrypto() with master key configuration first.'
    );
  }
  return registry;
}

function registerKeys(config: CryptoInitializationConfig): void {
  const { currentKey, currentKeyVersion, previousKeys } = config;

  if (!Number.isInteger(currentKeyVersion) || currentKeyVersion <= 0) {
    throw new Error('Invalid master encryption key version. Version must be a positive integer.');
  }

  if (!isValidMasterKey(currentKey)) {
    throw new Error(INVALID_KEY_ERROR);
  }

  const keys = new Map<number, string>();
  keys.set(currentKeyVersion, currentKey);

  if (previousKeys) {
    for (const [rawVersion, key] of Object.entries(previousKeys)) {
      const version = Number(rawVersion);

      if (!Number.isInteger(version) || version <= 0) {
        throw new Error(`Invalid master key version: ${rawVersion}`);
      }

      if (keys.has(version)) {
        throw new Error(`Duplicate master key entry for version ${version}`);
      }

      if (!isValidMasterKey(key)) {
        throw new Error(INVALID_KEY_ERROR);
      }

      keys.set(version, key);
    }
  }

  registry = {
    currentVersion: currentKeyVersion,
    keys,
  };
}

function getMasterKey(version?: number): string {
  const { currentVersion, keys } = assertRegistry();
  const resolvedVersion = version ?? currentVersion;
  const masterKey = keys.get(resolvedVersion);

  if (!masterKey) {
    throw new Error(`No master encryption key registered for version ${resolvedVersion}`);
  }

  return masterKey;
}

/**
 * Initializes the crypto package with the master encryption key.
 *
 * This should be called once during application startup, typically in your
 * main server initialization code. The key should come from the
 * MASTER_ENCRYPTION_KEY environment variable.
 *
 * @param key - The master encryption key from environment variables
 * @throws {Error} If key is invalid or doesn't meet security requirements
 *
 * @example
 * ```typescript
 * import { initializeCrypto } from '@ocsuite/crypto';
 *
 * // In your app initialization
 * initializeCrypto(process.env.MASTER_ENCRYPTION_KEY!);
 * ```
 */
export function initializeCrypto(input: string | CryptoInitializationConfig): void {
  if (typeof input === 'string') {
    if (!isValidMasterKey(input)) {
      throw new Error(INVALID_KEY_ERROR);
    }

    registry = {
      currentVersion: 1,
      keys: new Map([[1, input]]),
    };
    return;
  }

  if (!isRotationConfig(input)) {
    throw new Error('Invalid crypto initialization configuration.');
  }

  registerKeys(input);
}

/**
 * Gets the master encryption key, throwing if not initialized.
 *
 * @returns The master encryption key
 * @throws {Error} If crypto package not initialized
 */
export function getCurrentKeyVersion(): number {
  return assertRegistry().currentVersion;
}

/**
 * Encrypts plaintext for a specific tenant and context.
 *
 * This is the primary function for encrypting tenant data. It:
 * 1. Derives a tenant-specific key using HKDF
 * 2. Encrypts the plaintext with AES-256-GCM
 * 3. Returns base64-encoded ciphertext safe for database storage
 *
 * The same tenantId + context combination will always use the same derived key,
 * ensuring data can be decrypted later. However, each encryption operation uses
 * a unique IV, so the same plaintext encrypted twice produces different ciphertexts.
 *
 * @param plaintext - The sensitive data to encrypt (e.g., API tokens, credentials)
 * @param tenantId - The unique tenant identifier (e.g., "tenant-123")
 * @param context - The purpose/context for this encryption (e.g., "connector-tokens")
 * @returns Base64-encoded ciphertext that can be stored in a database
 *
 * @throws {Error} If crypto package not initialized
 * @throws {Error} If any parameter is invalid
 * @throws {Error} If encryption fails
 *
 * @example
 * ```typescript
 * // Encrypt an API token for a tenant
 * const encrypted = encryptForTenant(
 *   apiToken,
 *   'tenant-123',
 *   'connector-tokens'
 * );
 *
 * // Store in database
 * await db.connectors.update({
 *   where: { id: connectorId },
 *   data: { encryptedToken: encrypted }
 * });
 * ```
 */
export function encryptForTenant(
  plaintext: string,
  tenantId: string,
  context: string
): string {
  const masterKey = getMasterKey();
  const derivedKey = deriveKey(masterKey, tenantId, context);

  try {
    return encrypt(plaintext, derivedKey);
  } finally {
    // Wipe the derived key from memory
    wipeBuffer(derivedKey);
  }
}

/**
 * Decrypts ciphertext for a specific tenant and context.
 *
 * This is the primary function for decrypting tenant data. It:
 * 1. Derives the same tenant-specific key using HKDF
 * 2. Decrypts and authenticates the ciphertext
 * 3. Returns the plaintext
 *
 * The tenantId and context MUST match those used during encryption, or
 * decryption will fail with an AuthenticationError.
 *
 * CRITICAL SECURITY WARNING:
 * - Use the decrypted value immediately and never cache it
 * - NEVER store decrypted values in Redis or any cache
 * - NEVER log decrypted values
 * - Clear the decrypted value from memory as soon as possible
 *
 * @param ciphertext - The base64-encoded encrypted data from encryptForTenant()
 * @param tenantId - The unique tenant identifier (must match encryption)
 * @param context - The purpose/context (must match encryption)
 * @returns The decrypted plaintext
 *
 * @throws {Error} If crypto package not initialized
 * @throws {InvalidCiphertextError} If ciphertext format is invalid
 * @throws {AuthenticationError} If authentication fails (wrong key or tampering)
 * @throws {Error} If decryption fails
 *
 * @example
 * ```typescript
 * // Retrieve encrypted token from database
 * const connector = await db.connectors.findUnique({
 *   where: { id: connectorId }
 * });
 *
 * // Decrypt for immediate use
 * const apiToken = decryptForTenant(
 *   connector.encryptedToken,
 *   'tenant-123',
 *   'connector-tokens'
 * );
 *
 * // Use immediately
 * const response = await fetch(apiUrl, {
 *   headers: { Authorization: `Bearer ${apiToken}` }
 * });
 *
 * // DO NOT cache apiToken anywhere!
 * ```
 */
export function decryptForTenant(
  ciphertext: string,
  tenantId: string,
  context: string
): string {
  return decryptForTenantWithVersion(ciphertext, tenantId, context);
}

/**
 * Decrypts ciphertext for a specific tenant, context, and key version.
 *
 * @param ciphertext - The base64-encoded encrypted data
 * @param tenantId - The tenant identifier
 * @param context - Encryption context
 * @param keyVersion - Optional master key version to use for decryption
 * @returns The decrypted plaintext
 */
export function decryptForTenantWithVersion(
  ciphertext: string,
  tenantId: string,
  context: string,
  keyVersion?: number
): string {
  const masterKey = getMasterKey(keyVersion);
  const derivedKey = deriveKey(masterKey, tenantId, context);

  try {
    return decrypt(ciphertext, derivedKey);
  } finally {
    wipeBuffer(derivedKey);
  }
}

/**
 * Type guard to check if an error is an AuthenticationError.
 *
 * @param error - The error to check
 * @returns True if error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard to check if an error is an InvalidCiphertextError.
 *
 * @param error - The error to check
 * @returns True if error is an InvalidCiphertextError
 */
export function isInvalidCiphertextError(error: unknown): error is InvalidCiphertextError {
  return error instanceof InvalidCiphertextError;
}

/**
 * Checks if an error is a crypto-related error (authentication or invalid ciphertext).
 *
 * @param error - The error to check
 * @returns True if error is crypto-related
 */
export function isCryptoError(error: unknown): boolean {
  return isAuthenticationError(error) || isInvalidCiphertextError(error);
}
