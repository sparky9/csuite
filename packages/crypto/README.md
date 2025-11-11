# @ocsuite/crypto

Tenant-specific encryption using HKDF key derivation for the Online C-Suite platform.

## Overview

This package provides secure, tenant-isolated encryption for sensitive data in a multi-tenant environment. It uses HKDF (HMAC-based Key Derivation Function) to derive unique encryption keys for each tenant from a single master key, ensuring complete data isolation between tenants.

### Key Features

- **Tenant Isolation**: Each tenant gets unique encryption keys derived from a master key
- **Context-Specific Keys**: Different purposes (e.g., tokens vs data) use different keys
- **Authenticated Encryption**: AES-256-GCM provides both confidentiality and authenticity
- **Zero External Dependencies**: Uses only Node.js built-in crypto module
- **Production-Ready**: Comprehensive tests and security-focused implementation

## Security Architecture

### HKDF Key Derivation

HKDF (HMAC-based Key Derivation Function) is a cryptographically secure method to derive multiple keys from a single master key. This package uses HKDF with HMAC-SHA256.

**Why HKDF?**

1. **Key Isolation**: Each tenant gets a unique key, preventing cross-tenant data access
2. **Forward Security**: Compromising one tenant's key doesn't expose other tenants
3. **Deterministic**: Same inputs always produce the same key (required for decryption)
4. **Standards-Based**: HKDF is defined in RFC 5869 and widely used in production systems

**Key Derivation Formula**:
```
DerivedKey = HKDF-Extract-Expand(MasterKey, tenantId:context)
```

### AES-256-GCM Encryption

All encryption uses AES-256-GCM (Galois/Counter Mode) which provides:

- **Confidentiality**: Data is encrypted with AES-256
- **Authenticity**: Built-in authentication prevents tampering
- **Integrity**: Any modification to ciphertext is detected during decryption

**Output Format**:
```
IV (12 bytes) | AuthTag (16 bytes) | Ciphertext (variable)
```

Everything is encoded as base64 for safe storage in databases.

## Installation

This is an internal package. Install it as part of the monorepo:

```bash
pnpm install
```

## Usage

### Basic Setup

Initialize the crypto package once during application startup:

```typescript
import { initializeCrypto } from '@ocsuite/crypto';

// In your main server file (e.g., index.ts)
initializeCrypto(process.env.MASTER_ENCRYPTION_KEY!);
```

### Encrypting Data

Use `encryptForTenant()` to encrypt sensitive data:

```typescript
import { encryptForTenant } from '@ocsuite/crypto';

// Encrypt an API token for a connector
const apiToken = 'sk-proj-1234567890...';
const encryptedToken = encryptForTenant(
  apiToken,
  'tenant-123',
  'connector-tokens'
);

// Store in database
await db.connectors.update({
  where: { id: connectorId },
  data: { encryptedToken }
});
```

### Decrypting Data

Use `decryptForTenant()` to decrypt sensitive data:

```typescript
import { decryptForTenant } from '@ocsuite/crypto';

// Retrieve from database
const connector = await db.connectors.findUnique({
  where: { id: connectorId }
});

// Decrypt for immediate use
const apiToken = decryptForTenant(
  connector.encryptedToken,
  'tenant-123',
  'connector-tokens'
);

// Use immediately
const response = await fetch(apiUrl, {
  headers: { Authorization: `Bearer ${apiToken}` }
});

// DO NOT cache apiToken anywhere!
```

### Error Handling

The package provides specific error types for different failure modes:

```typescript
import {
  decryptForTenant,
  isAuthenticationError,
  isInvalidCiphertextError,
  isCryptoError
} from '@ocsuite/crypto';

try {
  const decrypted = decryptForTenant(ciphertext, tenantId, context);
  return decrypted;
} catch (error) {
  if (isAuthenticationError(error)) {
    // Ciphertext was tampered with or wrong key used
    console.error('Authentication failed - possible tampering detected');
    throw new Error('Data integrity check failed');
  } else if (isInvalidCiphertextError(error)) {
    // Ciphertext format is invalid
    console.error('Invalid ciphertext format');
    throw new Error('Corrupted data');
  } else {
    // Other errors
    console.error('Decryption failed:', error);
    throw error;
  }
}
```

## API Reference

### High-Level API (Recommended)

#### `initializeCrypto(key: string): void`

Initializes the crypto package with the master encryption key. Call once at startup.

- **Parameters**:
  - `key`: Master encryption key from `MASTER_ENCRYPTION_KEY` env var
- **Throws**: Error if key is invalid

#### `encryptForTenant(plaintext: string, tenantId: string, context: string): string`

Encrypts plaintext for a specific tenant and context.

- **Parameters**:
  - `plaintext`: The data to encrypt
  - `tenantId`: Unique tenant identifier
  - `context`: Purpose/context (e.g., "connector-tokens", "oauth-credentials")
- **Returns**: Base64-encoded ciphertext
- **Throws**: Error if parameters are invalid or encryption fails

#### `decryptForTenant(ciphertext: string, tenantId: string, context: string): string`

Decrypts ciphertext for a specific tenant and context.

- **Parameters**:
  - `ciphertext`: Base64-encoded encrypted data
  - `tenantId`: Unique tenant identifier (must match encryption)
  - `context`: Purpose/context (must match encryption)
- **Returns**: Decrypted plaintext
- **Throws**:
  - `InvalidCiphertextError`: If ciphertext format is invalid
  - `AuthenticationError`: If authentication fails (tampering or wrong key)

### Low-Level API (Advanced)

#### `deriveKey(masterKey: string, tenantId: string, context: string): Buffer`

Derives a tenant-specific encryption key using HKDF.

- **Returns**: 32-byte (256-bit) derived key

#### `encrypt(plaintext: string, key: Buffer): string`

Encrypts plaintext using AES-256-GCM.

- **Returns**: Base64-encoded ciphertext

#### `decrypt(ciphertext: string, key: Buffer): string`

Decrypts ciphertext using AES-256-GCM.

- **Returns**: Decrypted plaintext

#### `generateMasterKey(): string`

Generates a cryptographically secure master key. Use ONCE during setup.

- **Returns**: 64-character hex string (256 bits)

## Security Considerations

### CRITICAL: Never Cache Decrypted Values

**DO NOT** cache decrypted values in Redis or any other cache:

```typescript
// ❌ NEVER DO THIS
const apiToken = decryptForTenant(encrypted, tenantId, context);
await redis.set(`token:${tenantId}`, apiToken); // SECURITY VULNERABILITY!

// ✅ DO THIS INSTEAD
const apiToken = decryptForTenant(encrypted, tenantId, context);
// Use immediately and let it go out of scope
await makeApiCall(apiToken);
```

**Why?** Caching decrypted values:
- Expands the attack surface (more places to steal secrets)
- Increases exposure time (secrets persist longer than needed)
- May violate compliance requirements (PCI-DSS, HIPAA, etc.)
- Bypasses the security benefits of encryption at rest

### Master Key Management

The master encryption key is the most sensitive piece of data in the system. Protect it carefully:

1. **Generation**: Use `generateMasterKey()` ONCE during initial setup
2. **Storage**: Store in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Access**: Limit access to production master key to minimal personnel
4. **Rotation**: Plan for key rotation with a versioning scheme
5. **Never Log**: Never log the master key or derived keys

```typescript
// ❌ NEVER DO THIS
console.log('Master key:', process.env.MASTER_ENCRYPTION_KEY);

// ✅ DO THIS
if (!process.env.MASTER_ENCRYPTION_KEY) {
  throw new Error('MASTER_ENCRYPTION_KEY environment variable not set');
}
initializeCrypto(process.env.MASTER_ENCRYPTION_KEY);
```

### Context Best Practices

Use specific contexts for different types of data:

- `connector-tokens`: API tokens for third-party integrations
- `oauth-credentials`: OAuth access/refresh tokens
- `api-keys`: Customer API keys
- `pii-data`: Personally identifiable information
- `payment-data`: Payment method information

```typescript
// ✅ Good: Specific context
encryptForTenant(apiToken, tenantId, 'connector-tokens');

// ❌ Bad: Generic context
encryptForTenant(apiToken, tenantId, 'data');
```

### Tenant ID Security

- Always validate tenant IDs before encryption/decryption
- Never trust tenant IDs from client input without verification
- Use UUIDs or database-generated IDs, not user-controlled values

### Key Rotation

To rotate the master encryption key:

1. Generate new master key with `generateMasterKey()`
2. Deploy code that can decrypt with old key and encrypt with new key
3. Re-encrypt all data using the new key
4. Remove old key after all data is re-encrypted

Example migration:

```typescript
// During migration period, support both keys
const oldKey = process.env.MASTER_ENCRYPTION_KEY_OLD!;
const newKey = process.env.MASTER_ENCRYPTION_KEY_NEW!;

async function migrateData(record) {
  // Decrypt with old key
  const oldDerivedKey = deriveKey(oldKey, record.tenantId, 'connector-tokens');
  const plaintext = decrypt(record.encryptedToken, oldDerivedKey);

  // Re-encrypt with new key
  const newDerivedKey = deriveKey(newKey, record.tenantId, 'connector-tokens');
  const newEncrypted = encrypt(plaintext, newDerivedKey);

  // Update database
  await db.update({ id: record.id }, { encryptedToken: newEncrypted });
}
```

## Example Use Cases

### Encrypting Connector API Tokens

```typescript
import { encryptForTenant, decryptForTenant } from '@ocsuite/crypto';

// When user connects a third-party service
async function saveConnector(tenantId: string, provider: string, apiToken: string) {
  const encryptedToken = encryptForTenant(
    apiToken,
    tenantId,
    'connector-tokens'
  );

  await db.connectors.create({
    data: {
      tenantId,
      provider,
      encryptedToken
    }
  });
}

// When making API calls to third-party service
async function fetchDataFromConnector(connectorId: string) {
  const connector = await db.connectors.findUnique({
    where: { id: connectorId }
  });

  // Decrypt just-in-time
  const apiToken = decryptForTenant(
    connector.encryptedToken,
    connector.tenantId,
    'connector-tokens'
  );

  // Use immediately
  const response = await fetch(`${connector.apiUrl}/data`, {
    headers: { Authorization: `Bearer ${apiToken}` }
  });

  return response.json();
}
```

### Encrypting OAuth Credentials

```typescript
async function saveOAuthTokens(tenantId: string, tokens: OAuthTokens) {
  const encryptedTokens = encryptForTenant(
    JSON.stringify(tokens),
    tenantId,
    'oauth-credentials'
  );

  await db.oauthCredentials.create({
    data: {
      tenantId,
      encryptedTokens
    }
  });
}

async function refreshAccessToken(tenantId: string) {
  const creds = await db.oauthCredentials.findUnique({
    where: { tenantId }
  });

  const tokens = JSON.parse(
    decryptForTenant(creds.encryptedTokens, tenantId, 'oauth-credentials')
  );

  // Use refresh token immediately
  const newTokens = await oauth.refreshToken(tokens.refreshToken);

  // Re-encrypt and save new tokens
  await saveOAuthTokens(tenantId, newTokens);
}
```

## Testing

Run the test suite:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

The package includes comprehensive tests covering:
- Key derivation consistency and isolation
- Encryption/decryption round-trips
- Authentication failure detection (GCM)
- Error handling for invalid inputs
- Tampering detection
- Multi-tenant isolation
- Real-world use cases

## License

Internal use only - Online C-Suite platform.

## Security Disclosure

If you discover a security vulnerability in this package, please report it immediately to the security team. Do not create public GitHub issues for security vulnerabilities.
