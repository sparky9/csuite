/**
 * Versioning support for module capabilities.
 *
 * This module implements semantic versioning for capability compatibility checking.
 * Workers and the control plane use these utilities to ensure version compatibility.
 *
 * Versioning Strategy:
 * - Capability names include major version: "capability-name-v{major}"
 * - Full version stored in capability.version field: "major.minor.patch"
 * - Breaking changes require new capability name with incremented major version
 * - Minor/patch updates maintain backward compatibility
 * - Control plane can route to compatible versions based on requirements
 */

import * as semver from 'semver';

/**
 * Parsed capability version information
 */
export interface CapabilityVersion {
  /**
   * Base name without version suffix
   * Example: "analyze-financials" from "analyze-financials-v1"
   */
  baseName: string;

  /**
   * Major version from capability name
   * Example: 1 from "analyze-financials-v1"
   */
  majorVersion: number;

  /**
   * Full semantic version if available
   * Example: "1.2.3"
   */
  fullVersion?: string;
}

/**
 * Parses a capability name to extract version information.
 *
 * Capability names must follow the format: "{name}-v{major}"
 * Optional full version can be provided separately.
 *
 * @param name - Capability name (e.g., "analyze-financials-v1")
 * @param fullVersion - Optional full semantic version (e.g., "1.2.3")
 * @returns Parsed version information or null if format is invalid
 *
 * @example
 * ```typescript
 * const version = parseCapabilityVersion("analyze-financials-v1", "1.2.3");
 * // Returns:
 * // {
 * //   baseName: "analyze-financials",
 * //   majorVersion: 1,
 * //   fullVersion: "1.2.3"
 * // }
 * ```
 */
export function parseCapabilityVersion(
  name: string,
  fullVersion?: string
): CapabilityVersion | null {
  // Match capability name format: {name}-v{major}
  const match = name.match(/^(.+)-v(\d+)$/);

  if (!match) {
    return null;
  }

  const baseName = match[1];
  const majorVersion = parseInt(match[2] ?? '0', 10);

  if (!baseName || isNaN(majorVersion)) {
    return null;
  }

  return {
    baseName,
    majorVersion,
    fullVersion,
  };
}

/**
 * Extracts the major version from a capability name.
 *
 * @param name - Capability name (e.g., "analyze-financials-v1")
 * @returns Major version number or null if format is invalid
 *
 * @example
 * ```typescript
 * getMajorVersion("analyze-financials-v1"); // Returns: 1
 * getMajorVersion("invalid-name"); // Returns: null
 * ```
 */
export function getMajorVersion(name: string): number | null {
  const version = parseCapabilityVersion(name);
  return version ? version.majorVersion : null;
}

/**
 * Extracts the base name (without version) from a capability name.
 *
 * @param name - Capability name (e.g., "analyze-financials-v1")
 * @returns Base name or null if format is invalid
 *
 * @example
 * ```typescript
 * getBaseName("analyze-financials-v1"); // Returns: "analyze-financials"
 * getBaseName("invalid-name"); // Returns: null
 * ```
 */
export function getBaseName(name: string): string | null {
  const version = parseCapabilityVersion(name);
  return version ? version.baseName : null;
}

/**
 * Checks if a provided capability version is compatible with a required version.
 *
 * Compatibility Rules:
 * 1. Major versions must match exactly (breaking changes)
 * 2. Provided minor version must be >= required minor version
 * 3. Patch version differences are always compatible
 *
 * Examples:
 * - Required: 1.0.0, Provided: 1.2.3 → Compatible (same major, higher minor)
 * - Required: 1.5.0, Provided: 1.4.9 → Incompatible (lower minor)
 * - Required: 2.0.0, Provided: 1.9.9 → Incompatible (different major)
 * - Required: 1.0.0, Provided: 1.0.1 → Compatible (patch difference)
 *
 * @param required - Required version string (e.g., "1.2.0")
 * @param provided - Provided version string (e.g., "1.3.0")
 * @returns true if versions are compatible, false otherwise
 *
 * @example
 * ```typescript
 * isCompatible("1.0.0", "1.2.3"); // true - compatible minor upgrade
 * isCompatible("1.5.0", "1.4.9"); // false - provided version too old
 * isCompatible("2.0.0", "1.9.9"); // false - major version mismatch
 * ```
 */
export function isCompatible(required: string, provided: string): boolean {
  // Validate version strings
  if (!semver.valid(required) || !semver.valid(provided)) {
    return false;
  }

  const requiredSemver = semver.parse(required);
  const providedSemver = semver.parse(provided);

  if (!requiredSemver || !providedSemver) {
    return false;
  }

  // Major versions must match exactly (breaking changes)
  if (requiredSemver.major !== providedSemver.major) {
    return false;
  }

  // Provided version must be >= required version for minor and patch
  // This allows forward compatibility within the same major version
  return semver.gte(provided, required);
}

/**
 * Checks if two capability names refer to the same capability (ignoring version).
 *
 * @param name1 - First capability name
 * @param name2 - Second capability name
 * @returns true if base names match, false otherwise
 *
 * @example
 * ```typescript
 * isSameCapability("analyze-financials-v1", "analyze-financials-v2"); // true
 * isSameCapability("analyze-financials-v1", "generate-report-v1"); // false
 * ```
 */
export function isSameCapability(name1: string, name2: string): boolean {
  const base1 = getBaseName(name1);
  const base2 = getBaseName(name2);

  if (!base1 || !base2) {
    return false;
  }

  return base1 === base2;
}

/**
 * Finds the best matching capability from a list based on version requirements.
 *
 * Selection Strategy:
 * 1. Filter to capabilities with matching base name
 * 2. Filter to capabilities with compatible versions
 * 3. Return the highest compatible version
 *
 * @param requiredName - Required capability name with version
 * @param requiredVersion - Required semantic version
 * @param availableCapabilities - List of available capability names and versions
 * @returns Best matching capability or null if no compatible version found
 *
 * @example
 * ```typescript
 * const available = [
 *   { name: "analyze-financials-v1", version: "1.0.0" },
 *   { name: "analyze-financials-v1", version: "1.2.0" },
 *   { name: "analyze-financials-v2", version: "2.0.0" }
 * ];
 *
 * findBestMatch("analyze-financials-v1", "1.1.0", available);
 * // Returns: { name: "analyze-financials-v1", version: "1.2.0" }
 * ```
 */
export function findBestMatch(
  requiredName: string,
  requiredVersion: string,
  availableCapabilities: Array<{ name: string; version: string }>
): { name: string; version: string } | null {
  const requiredParsed = parseCapabilityVersion(requiredName, requiredVersion);

  if (!requiredParsed) {
    return null;
  }

  // Filter to matching base name and major version
  const candidates = availableCapabilities.filter((cap) => {
    const parsed = parseCapabilityVersion(cap.name, cap.version);
    return (
      parsed &&
      parsed.baseName === requiredParsed.baseName &&
      parsed.majorVersion === requiredParsed.majorVersion &&
      isCompatible(requiredVersion, cap.version)
    );
  });

  if (candidates.length === 0) {
    return null;
  }

  // Sort by version (highest first) and return the best match
  candidates.sort((a, b) => {
    return semver.rcompare(a.version, b.version);
  });

  return candidates[0] ?? null;
}

/**
 * Validates that a capability name follows the correct versioning format.
 *
 * Valid format: {name}-v{major} where:
 * - {name} contains only lowercase letters, numbers, and hyphens
 * - {major} is a positive integer
 *
 * @param name - Capability name to validate
 * @returns true if format is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidCapabilityName("analyze-financials-v1"); // true
 * isValidCapabilityName("analyze_financials-v1"); // false (underscore not allowed)
 * isValidCapabilityName("analyze-financials"); // false (missing version)
 * isValidCapabilityName("analyze-financials-v0"); // true (v0 is valid)
 * ```
 */
export function isValidCapabilityName(name: string): boolean {
  // Must match format: {name}-v{major}
  // {name} can contain: lowercase letters, numbers, hyphens
  const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*-v\d+$/;
  return namePattern.test(name);
}

/**
 * Generates a capability name from a base name and major version.
 *
 * @param baseName - Base capability name (e.g., "analyze-financials")
 * @param majorVersion - Major version number
 * @returns Formatted capability name
 *
 * @example
 * ```typescript
 * formatCapabilityName("analyze-financials", 1); // "analyze-financials-v1"
 * formatCapabilityName("generate-report", 2); // "generate-report-v2"
 * ```
 */
export function formatCapabilityName(
  baseName: string,
  majorVersion: number
): string {
  return `${baseName}-v${majorVersion}`;
}

/**
 * Validates that a version string is valid semantic version.
 *
 * @param version - Version string to validate
 * @returns true if valid semver, false otherwise
 *
 * @example
 * ```typescript
 * isValidVersion("1.2.3"); // true
 * isValidVersion("1.2"); // false (must have patch version)
 * isValidVersion("v1.2.3"); // false (no 'v' prefix)
 * ```
 */
export function isValidVersion(version: string): boolean {
  return semver.valid(version) !== null;
}
