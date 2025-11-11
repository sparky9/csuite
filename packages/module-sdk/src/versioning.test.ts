/**
 * Tests for versioning utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parseCapabilityVersion,
  getMajorVersion,
  getBaseName,
  isCompatible,
  isSameCapability,
  findBestMatch,
  isValidCapabilityName,
  formatCapabilityName,
  isValidVersion,
} from './versioning.js';

describe('parseCapabilityVersion', () => {
  it('parses valid capability name with version', () => {
    const result = parseCapabilityVersion('analyze-financials-v1', '1.2.3');

    expect(result).not.toBeNull();
    expect(result?.baseName).toBe('analyze-financials');
    expect(result?.majorVersion).toBe(1);
    expect(result?.fullVersion).toBe('1.2.3');
  });

  it('parses capability name without full version', () => {
    const result = parseCapabilityVersion('test-capability-v2');

    expect(result).not.toBeNull();
    expect(result?.baseName).toBe('test-capability');
    expect(result?.majorVersion).toBe(2);
    expect(result?.fullVersion).toBeUndefined();
  });

  it('handles multi-hyphenated names', () => {
    const result = parseCapabilityVersion('generate-monthly-report-v3');

    expect(result).not.toBeNull();
    expect(result?.baseName).toBe('generate-monthly-report');
    expect(result?.majorVersion).toBe(3);
  });

  it('returns null for invalid format (missing version)', () => {
    const result = parseCapabilityVersion('analyze-financials');
    expect(result).toBeNull();
  });

  it('returns null for invalid format (no hyphen before version)', () => {
    const result = parseCapabilityVersion('analyze-financialsv1');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseCapabilityVersion('');
    expect(result).toBeNull();
  });

  it('handles v0 as valid version', () => {
    const result = parseCapabilityVersion('test-v0');

    expect(result).not.toBeNull();
    expect(result?.majorVersion).toBe(0);
  });
});

describe('getMajorVersion', () => {
  it('extracts major version from capability name', () => {
    expect(getMajorVersion('analyze-financials-v1')).toBe(1);
    expect(getMajorVersion('test-v2')).toBe(2);
    expect(getMajorVersion('capability-v99')).toBe(99);
  });

  it('returns null for invalid format', () => {
    expect(getMajorVersion('invalid-name')).toBeNull();
    expect(getMajorVersion('')).toBeNull();
  });
});

describe('getBaseName', () => {
  it('extracts base name from capability name', () => {
    expect(getBaseName('analyze-financials-v1')).toBe('analyze-financials');
    expect(getBaseName('test-v2')).toBe('test');
    expect(getBaseName('multi-word-name-v3')).toBe('multi-word-name');
  });

  it('returns null for invalid format', () => {
    expect(getBaseName('invalid-name')).toBeNull();
    expect(getBaseName('')).toBeNull();
  });
});

describe('isCompatible', () => {
  it('returns true for exact version match', () => {
    expect(isCompatible('1.0.0', '1.0.0')).toBe(true);
  });

  it('returns true for compatible minor version upgrade', () => {
    expect(isCompatible('1.0.0', '1.2.0')).toBe(true);
    expect(isCompatible('1.0.0', '1.1.0')).toBe(true);
  });

  it('returns true for compatible patch version upgrade', () => {
    expect(isCompatible('1.0.0', '1.0.5')).toBe(true);
    expect(isCompatible('1.2.0', '1.2.3')).toBe(true);
  });

  it('returns false for lower minor version', () => {
    expect(isCompatible('1.5.0', '1.4.0')).toBe(false);
  });

  it('returns false for lower patch version', () => {
    expect(isCompatible('1.2.5', '1.2.3')).toBe(false);
  });

  it('returns false for major version mismatch', () => {
    expect(isCompatible('2.0.0', '1.9.9')).toBe(false);
    expect(isCompatible('1.0.0', '2.0.0')).toBe(false);
  });

  it('returns false for invalid version strings', () => {
    expect(isCompatible('invalid', '1.0.0')).toBe(false);
    expect(isCompatible('1.0.0', 'invalid')).toBe(false);
    expect(isCompatible('1.0', '1.0.0')).toBe(false);
  });

  it('handles prerelease versions', () => {
    // Note: semver.gte considers 1.0.0 > 1.0.0-beta
    expect(isCompatible('1.0.0-beta', '1.0.0')).toBe(true);
    expect(isCompatible('1.0.0', '1.0.0-beta')).toBe(false);
  });
});

describe('isSameCapability', () => {
  it('returns true for same capability with different versions', () => {
    expect(
      isSameCapability('analyze-financials-v1', 'analyze-financials-v2')
    ).toBe(true);
  });

  it('returns true for same capability with same version', () => {
    expect(
      isSameCapability('analyze-financials-v1', 'analyze-financials-v1')
    ).toBe(true);
  });

  it('returns false for different capabilities', () => {
    expect(isSameCapability('analyze-financials-v1', 'generate-report-v1')).toBe(
      false
    );
  });

  it('returns false for invalid names', () => {
    expect(isSameCapability('invalid', 'analyze-financials-v1')).toBe(false);
    expect(isSameCapability('analyze-financials-v1', 'invalid')).toBe(false);
  });
});

describe('findBestMatch', () => {
  it('finds highest compatible version', () => {
    const available = [
      { name: 'analyze-financials-v1', version: '1.0.0' },
      { name: 'analyze-financials-v1', version: '1.2.0' },
      { name: 'analyze-financials-v1', version: '1.1.5' },
    ];

    const result = findBestMatch('analyze-financials-v1', '1.0.0', available);

    expect(result).not.toBeNull();
    expect(result?.version).toBe('1.2.0');
  });

  it('filters out incompatible versions', () => {
    const available = [
      { name: 'analyze-financials-v1', version: '1.0.0' },
      { name: 'analyze-financials-v1', version: '1.1.0' },
      { name: 'analyze-financials-v1', version: '1.3.0' },
    ];

    const result = findBestMatch('analyze-financials-v1', '1.2.0', available);

    expect(result).not.toBeNull();
    expect(result?.version).toBe('1.3.0');
  });

  it('filters out different major versions', () => {
    const available = [
      { name: 'analyze-financials-v1', version: '1.2.0' },
      { name: 'analyze-financials-v2', version: '2.0.0' },
    ];

    const result = findBestMatch('analyze-financials-v1', '1.0.0', available);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('analyze-financials-v1');
    expect(result?.version).toBe('1.2.0');
  });

  it('returns null when no compatible versions exist', () => {
    const available = [
      { name: 'analyze-financials-v1', version: '1.0.0' },
      { name: 'analyze-financials-v1', version: '1.1.0' },
    ];

    const result = findBestMatch('analyze-financials-v1', '1.5.0', available);
    expect(result).toBeNull();
  });

  it('returns null for invalid required name', () => {
    const available = [
      { name: 'analyze-financials-v1', version: '1.0.0' },
    ];

    const result = findBestMatch('invalid-name', '1.0.0', available);
    expect(result).toBeNull();
  });

  it('ignores different capability names', () => {
    const available = [
      { name: 'analyze-financials-v1', version: '1.0.0' },
      { name: 'generate-report-v1', version: '1.5.0' },
    ];

    const result = findBestMatch('analyze-financials-v1', '1.0.0', available);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('analyze-financials-v1');
  });

  it('handles empty available list', () => {
    const result = findBestMatch('test-v1', '1.0.0', []);
    expect(result).toBeNull();
  });
});

describe('isValidCapabilityName', () => {
  it('validates correct capability names', () => {
    expect(isValidCapabilityName('analyze-financials-v1')).toBe(true);
    expect(isValidCapabilityName('test-v0')).toBe(true);
    expect(isValidCapabilityName('multi-word-capability-v99')).toBe(true);
    expect(isValidCapabilityName('name123-v1')).toBe(true);
  });

  it('rejects names without version', () => {
    expect(isValidCapabilityName('analyze-financials')).toBe(false);
  });

  it('rejects names with invalid characters', () => {
    expect(isValidCapabilityName('analyze_financials-v1')).toBe(false);
    expect(isValidCapabilityName('Analyze-Financials-v1')).toBe(false); // uppercase
    expect(isValidCapabilityName('analyze financials-v1')).toBe(false); // space
  });

  it('rejects names with invalid version format', () => {
    expect(isValidCapabilityName('analyze-financials-v')).toBe(false);
    expect(isValidCapabilityName('analyze-financials-1')).toBe(false);
    expect(isValidCapabilityName('analyze-financials-v1.0')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidCapabilityName('')).toBe(false);
  });

  it('rejects names starting or ending with hyphen', () => {
    expect(isValidCapabilityName('-analyze-v1')).toBe(false);
    expect(isValidCapabilityName('analyze--v1')).toBe(false);
  });
});

describe('formatCapabilityName', () => {
  it('formats capability name correctly', () => {
    expect(formatCapabilityName('analyze-financials', 1)).toBe(
      'analyze-financials-v1'
    );
    expect(formatCapabilityName('test', 2)).toBe('test-v2');
    expect(formatCapabilityName('multi-word-name', 99)).toBe(
      'multi-word-name-v99'
    );
  });

  it('handles v0', () => {
    expect(formatCapabilityName('test', 0)).toBe('test-v0');
  });
});

describe('isValidVersion', () => {
  it('validates correct semantic versions', () => {
    expect(isValidVersion('1.0.0')).toBe(true);
    expect(isValidVersion('0.0.1')).toBe(true);
    expect(isValidVersion('10.20.30')).toBe(true);
    expect(isValidVersion('1.0.0-beta')).toBe(true);
    expect(isValidVersion('1.0.0-beta.1')).toBe(true);
  });

  it('rejects invalid version formats', () => {
    expect(isValidVersion('1.0')).toBe(false);
    expect(isValidVersion('1')).toBe(false);
    expect(isValidVersion('1.0.0.0')).toBe(false);
    expect(isValidVersion('invalid')).toBe(false);
    expect(isValidVersion('')).toBe(false);
  });

  it('accepts version with v prefix (semver accepts this)', () => {
    // Note: semver.valid('v1.0.0') returns '1.0.0', so it's considered valid
    expect(isValidVersion('v1.0.0')).toBe(true);
  });
});
