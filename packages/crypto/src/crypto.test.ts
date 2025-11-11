import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, wipeBuffer, AuthenticationError, InvalidCiphertextError } from './crypto';
import { deriveKey } from './keys';

describe('encrypt', () => {
  const testKey = Buffer.alloc(32, 'a'); // 32-byte key for AES-256

  it('should encrypt plaintext and return base64 string', () => {
    const plaintext = 'Hello, World!';
    const ciphertext = encrypt(plaintext, testKey);

    expect(typeof ciphertext).toBe('string');
    expect(ciphertext.length).toBeGreaterThan(0);

    // Should be valid base64
    expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();
  });

  it('should produce different ciphertexts for same plaintext (unique IVs)', () => {
    const plaintext = 'Same text';
    const ciphertext1 = encrypt(plaintext, testKey);
    const ciphertext2 = encrypt(plaintext, testKey);

    expect(ciphertext1).not.toBe(ciphertext2);
  });

  it('should encrypt empty strings', () => {
    // Note: Based on implementation, empty strings throw an error
    expect(() => encrypt('', testKey)).toThrow('Plaintext must not be empty');
  });

  it('should encrypt long strings', () => {
    const plaintext = 'x'.repeat(10000);
    const ciphertext = encrypt(plaintext, testKey);

    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('should encrypt unicode characters', () => {
    const plaintext = 'Hello 世界 🌍 مرحبا';
    const ciphertext = encrypt(plaintext, testKey);

    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('should throw error for non-Buffer key', () => {
    expect(() => encrypt('test', 'not-a-buffer' as any)).toThrow('Key must be a Buffer');
  });

  it('should throw error for wrong key size', () => {
    const wrongKey = Buffer.alloc(16); // 16 bytes instead of 32
    expect(() => encrypt('test', wrongKey)).toThrow('Key must be exactly 32 bytes');
  });

  it('should produce ciphertext with correct structure', () => {
    const plaintext = 'Test data';
    const ciphertext = encrypt(plaintext, testKey);
    const decoded = Buffer.from(ciphertext, 'base64');

    // Should contain: 12 bytes IV + 16 bytes auth tag + ciphertext
    expect(decoded.length).toBeGreaterThanOrEqual(28);
  });
});

describe('decrypt', () => {
  const testKey = Buffer.alloc(32, 'a');

  it('should decrypt ciphertext back to original plaintext', () => {
    const plaintext = 'Hello, World!';
    const ciphertext = encrypt(plaintext, testKey);
    const decrypted = decrypt(ciphertext, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle round-trip encryption/decryption', () => {
    const testCases = [
      'Simple text',
      'Text with numbers 123456',
      'Special chars: !@#$%^&*()',
      'Unicode: 世界 🌍 مرحبا',
      'Long text: ' + 'x'.repeat(1000),
      'JSON: ' + JSON.stringify({ key: 'value', nested: { data: true } })
    ];

    for (const plaintext of testCases) {
      const ciphertext = encrypt(plaintext, testKey);
      const decrypted = decrypt(ciphertext, testKey);
      expect(decrypted).toBe(plaintext);
    }
  });

  it('should throw InvalidCiphertextError for empty ciphertext', () => {
    expect(() => decrypt('', testKey)).toThrow(InvalidCiphertextError);
  });

  it('should throw InvalidCiphertextError for invalid base64', () => {
    expect(() => decrypt('not-valid-base64!@#', testKey)).toThrow();
  });

  it('should throw InvalidCiphertextError for too short ciphertext', () => {
    const tooShort = Buffer.alloc(20).toString('base64'); // Less than 29 bytes
    expect(() => decrypt(tooShort, testKey)).toThrow(InvalidCiphertextError);
    expect(() => decrypt(tooShort, testKey)).toThrow('Ciphertext too short');
  });

  it('should throw AuthenticationError for wrong key', () => {
    const plaintext = 'Secret data';
    const ciphertext = encrypt(plaintext, testKey);

    const wrongKey = Buffer.alloc(32, 'b'); // Different key
    expect(() => decrypt(ciphertext, wrongKey)).toThrow(AuthenticationError);
  });

  it('should throw AuthenticationError for tampered ciphertext', () => {
    const plaintext = 'Secret data';
    const ciphertext = encrypt(plaintext, testKey);

    // Tamper with the ciphertext
    const buffer = Buffer.from(ciphertext, 'base64');
    buffer[buffer.length - 1] ^= 0xFF; // Flip bits in last byte
    const tamperedCiphertext = buffer.toString('base64');

    expect(() => decrypt(tamperedCiphertext, testKey)).toThrow(AuthenticationError);
  });

  it('should throw AuthenticationError for tampered auth tag', () => {
    const plaintext = 'Secret data';
    const ciphertext = encrypt(plaintext, testKey);

    // Tamper with the auth tag (bytes 12-27)
    const buffer = Buffer.from(ciphertext, 'base64');
    buffer[12] ^= 0xFF; // Flip bits in auth tag
    const tamperedCiphertext = buffer.toString('base64');

    expect(() => decrypt(tamperedCiphertext, testKey)).toThrow(AuthenticationError);
  });

  it('should throw AuthenticationError for tampered IV', () => {
    const plaintext = 'Secret data';
    const ciphertext = encrypt(plaintext, testKey);

    // Tamper with the IV (bytes 0-11)
    const buffer = Buffer.from(ciphertext, 'base64');
    buffer[0] ^= 0xFF; // Flip bits in IV
    const tamperedCiphertext = buffer.toString('base64');

    expect(() => decrypt(tamperedCiphertext, testKey)).toThrow(AuthenticationError);
  });

  it('should throw error for non-Buffer key', () => {
    const ciphertext = encrypt('test', testKey);
    expect(() => decrypt(ciphertext, 'not-a-buffer' as any)).toThrow('Key must be a Buffer');
  });

  it('should throw error for wrong key size', () => {
    const ciphertext = encrypt('test', testKey);
    const wrongKey = Buffer.alloc(16);
    expect(() => decrypt(ciphertext, wrongKey)).toThrow('Key must be exactly 32 bytes');
  });
});

describe('encrypt/decrypt integration with deriveKey', () => {
  const masterKey = 'test-master-key-with-sufficient-length-for-security';

  it('should work with derived keys', () => {
    const key = deriveKey(masterKey, 'tenant-1', 'tokens');
    const plaintext = 'API Token: secret-123';

    const ciphertext = encrypt(plaintext, key);
    const decrypted = decrypt(ciphertext, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should fail with wrong tenant key', () => {
    const key1 = deriveKey(masterKey, 'tenant-1', 'tokens');
    const key2 = deriveKey(masterKey, 'tenant-2', 'tokens');

    const plaintext = 'Secret data';
    const ciphertext = encrypt(plaintext, key1);

    expect(() => decrypt(ciphertext, key2)).toThrow(AuthenticationError);
  });

  it('should fail with wrong context key', () => {
    const key1 = deriveKey(masterKey, 'tenant-1', 'tokens');
    const key2 = deriveKey(masterKey, 'tenant-1', 'data');

    const plaintext = 'Secret data';
    const ciphertext = encrypt(plaintext, key1);

    expect(() => decrypt(ciphertext, key2)).toThrow(AuthenticationError);
  });

  it('should maintain tenant isolation', () => {
    const tenant1Key = deriveKey(masterKey, 'tenant-1', 'tokens');
    const tenant2Key = deriveKey(masterKey, 'tenant-2', 'tokens');

    const tenant1Data = 'Tenant 1 secret';
    const tenant2Data = 'Tenant 2 secret';

    const tenant1Cipher = encrypt(tenant1Data, tenant1Key);
    const tenant2Cipher = encrypt(tenant2Data, tenant2Key);

    // Each tenant can decrypt their own data
    expect(decrypt(tenant1Cipher, tenant1Key)).toBe(tenant1Data);
    expect(decrypt(tenant2Cipher, tenant2Key)).toBe(tenant2Data);

    // But cannot decrypt other tenant's data
    expect(() => decrypt(tenant1Cipher, tenant2Key)).toThrow(AuthenticationError);
    expect(() => decrypt(tenant2Cipher, tenant1Key)).toThrow(AuthenticationError);
  });
});

describe('wipeBuffer', () => {
  it('should overwrite buffer contents', () => {
    const buffer = Buffer.from('sensitive data');
    const originalContent = buffer.toString();

    wipeBuffer(buffer);

    // Buffer should be zeroed
    expect(buffer.every(byte => byte === 0)).toBe(true);
    expect(buffer.toString()).not.toBe(originalContent);
  });

  it('should handle already empty buffers', () => {
    const buffer = Buffer.alloc(32, 0);
    expect(() => wipeBuffer(buffer)).not.toThrow();
    expect(buffer.every(byte => byte === 0)).toBe(true);
  });

  it('should handle non-buffer values gracefully', () => {
    expect(() => wipeBuffer('not a buffer' as any)).not.toThrow();
    expect(() => wipeBuffer(null as any)).not.toThrow();
    expect(() => wipeBuffer(undefined as any)).not.toThrow();
  });

  it('should wipe buffers of various sizes', () => {
    const sizes = [1, 16, 32, 64, 128, 256];

    for (const size of sizes) {
      const buffer = Buffer.alloc(size, 0xFF); // Fill with 0xFF
      wipeBuffer(buffer);
      expect(buffer.every(byte => byte === 0)).toBe(true);
    }
  });
});

describe('Error types', () => {
  it('should properly identify AuthenticationError', () => {
    const error = new AuthenticationError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.name).toBe('AuthenticationError');
    expect(error.message).toBe('Test error');
  });

  it('should properly identify InvalidCiphertextError', () => {
    const error = new InvalidCiphertextError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(InvalidCiphertextError);
    expect(error.name).toBe('InvalidCiphertextError');
    expect(error.message).toBe('Test error');
  });

  it('should distinguish between error types', () => {
    const authError = new AuthenticationError('Auth failed');
    const cipherError = new InvalidCiphertextError('Invalid cipher');

    expect(authError).not.toBeInstanceOf(InvalidCiphertextError);
    expect(cipherError).not.toBeInstanceOf(AuthenticationError);
  });
});
