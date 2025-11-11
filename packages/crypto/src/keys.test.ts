import { describe, it, expect } from 'vitest';
import { deriveKey, generateMasterKey, isValidMasterKey } from './keys';

describe('deriveKey', () => {
  const testMasterKey = 'test-master-key-with-sufficient-length-for-security-purposes';

  it('should derive a 32-byte key', () => {
    const key = deriveKey(testMasterKey, 'tenant-1', 'test-context');
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should produce consistent keys for same inputs', () => {
    const key1 = deriveKey(testMasterKey, 'tenant-1', 'tokens');
    const key2 = deriveKey(testMasterKey, 'tenant-1', 'tokens');

    expect(key1.equals(key2)).toBe(true);
  });

  it('should produce different keys for different tenants', () => {
    const key1 = deriveKey(testMasterKey, 'tenant-1', 'tokens');
    const key2 = deriveKey(testMasterKey, 'tenant-2', 'tokens');

    expect(key1.equals(key2)).toBe(false);
  });

  it('should produce different keys for different contexts', () => {
    const key1 = deriveKey(testMasterKey, 'tenant-1', 'tokens');
    const key2 = deriveKey(testMasterKey, 'tenant-1', 'data');

    expect(key1.equals(key2)).toBe(false);
  });

  it('should produce different keys for different master keys', () => {
    const key1 = deriveKey('master-key-one-with-sufficient-length', 'tenant-1', 'tokens');
    const key2 = deriveKey('master-key-two-with-sufficient-length', 'tenant-1', 'tokens');

    expect(key1.equals(key2)).toBe(false);
  });

  it('should throw error for empty master key', () => {
    expect(() => deriveKey('', 'tenant-1', 'tokens')).toThrow('Master key must not be empty');
  });

  it('should throw error for empty tenant ID', () => {
    expect(() => deriveKey(testMasterKey, '', 'tokens')).toThrow('Tenant ID must not be empty');
  });

  it('should throw error for empty context', () => {
    expect(() => deriveKey(testMasterKey, 'tenant-1', '')).toThrow('Context must not be empty');
  });

  it('should handle special characters in tenant ID and context', () => {
    const key = deriveKey(testMasterKey, 'tenant-@#$%', 'context-!@#');
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should produce different keys for similar tenant IDs', () => {
    const key1 = deriveKey(testMasterKey, 'tenant-1', 'tokens');
    const key2 = deriveKey(testMasterKey, 'tenant-10', 'tokens');
    const key3 = deriveKey(testMasterKey, 'tenant-11', 'tokens');

    expect(key1.equals(key2)).toBe(false);
    expect(key1.equals(key3)).toBe(false);
    expect(key2.equals(key3)).toBe(false);
  });
});

describe('generateMasterKey', () => {
  it('should generate a 64-character hex string', () => {
    const key = generateMasterKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64); // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });

  it('should generate different keys on each call', () => {
    const key1 = generateMasterKey();
    const key2 = generateMasterKey();
    const key3 = generateMasterKey();

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
    expect(key1).not.toBe(key3);
  });

  it('should generate cryptographically random keys', () => {
    // Generate multiple keys and check for patterns
    const keys = Array.from({ length: 10 }, () => generateMasterKey());

    // All should be unique
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(10);

    // None should be all zeros or all the same character
    for (const key of keys) {
      expect(key).not.toMatch(/^(.)\1+$/); // All same character
      expect(key).not.toBe('0'.repeat(64)); // All zeros
    }
  });
});

describe('isValidMasterKey', () => {
  it('should accept valid long keys', () => {
    const validKey = 'a'.repeat(64);
    expect(isValidMasterKey(validKey)).toBe(true);
  });

  it('should accept minimum length keys', () => {
    const minKey = 'a'.repeat(32);
    expect(isValidMasterKey(minKey)).toBe(true);
  });

  it('should reject empty keys', () => {
    expect(isValidMasterKey('')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(isValidMasterKey(null as any)).toBe(false);
    expect(isValidMasterKey(undefined as any)).toBe(false);
  });

  it('should reject non-string values', () => {
    expect(isValidMasterKey(12345 as any)).toBe(false);
    expect(isValidMasterKey({} as any)).toBe(false);
    expect(isValidMasterKey([] as any)).toBe(false);
  });

  it('should reject too short keys', () => {
    const shortKey = 'a'.repeat(31);
    expect(isValidMasterKey(shortKey)).toBe(false);
  });

  it('should reject weak keys with "test"', () => {
    expect(isValidMasterKey('test-key-that-is-long-enough-but-weak')).toBe(false);
  });

  it('should reject weak keys with "demo"', () => {
    expect(isValidMasterKey('demo-key-that-is-long-enough-but-weak')).toBe(false);
  });

  it('should reject weak keys with "password"', () => {
    expect(isValidMasterKey('password-that-is-long-enough-but-weak')).toBe(false);
  });

  it('should reject weak keys with "example"', () => {
    expect(isValidMasterKey('example-key-that-is-long-enough-but-weak')).toBe(false);
  });

  it('should reject weak keys with "12345"', () => {
    expect(isValidMasterKey('12345-key-that-is-long-enough-but-weak')).toBe(false);
  });

  it('should reject weak keys with "secret"', () => {
    expect(isValidMasterKey('secret-key-that-is-long-enough-but-weak')).toBe(false);
  });

  it('should be case insensitive for weak pattern detection', () => {
    expect(isValidMasterKey('TEST-key-that-is-long-enough-but-weak')).toBe(false);
    expect(isValidMasterKey('PASSWORD-that-is-long-enough-but-weak')).toBe(false);
  });
});
