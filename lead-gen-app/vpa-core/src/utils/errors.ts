/**
 * Custom Error Classes for VPA Core
 *
 * User-friendly error messages with proper error codes and upgrade URLs.
 * These errors are designed to provide helpful feedback to users via Claude.
 */

/**
 * Base VPA Error class
 */
export class VPAError extends Error {
  constructor(
    message: string,
    public userMessage: string, // What user sees in Claude
    public errorCode: string,
    public upgradeUrl?: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'VPAError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.userMessage,
      errorCode: this.errorCode,
      upgradeUrl: this.upgradeUrl
    };
  }
}

/**
 * Module not enabled in user's subscription
 */
export class ModuleNotEnabledError extends VPAError {
  constructor(moduleName: string, upgradeUrl: string = 'https://yourapp.com/pricing') {
    super(
      `User attempted to access disabled module: ${moduleName}`,
      `${moduleName} is not included in your current plan. Upgrade to access this feature.`,
      'MODULE_NOT_ENABLED',
      upgradeUrl,
      403
    );
    this.name = 'ModuleNotEnabledError';
  }
}

/**
 * License key is invalid or expired
 */
export class LicenseExpiredError extends VPAError {
  constructor(reason?: string) {
    super(
      `License validation failed: ${reason || 'unknown'}`,
      'Your subscription has expired or is invalid. Please renew to continue using VPA.',
      'LICENSE_EXPIRED',
      'https://yourapp.com/billing',
      401
    );
    this.name = 'LicenseExpiredError';
  }
}

/**
 * Invalid license key format or not found
 */
export class InvalidLicenseError extends VPAError {
  constructor() {
    super(
      'Invalid license key provided',
      'Invalid license key. Please check your credentials and try again.',
      'INVALID_LICENSE',
      'https://yourapp.com/account',
      401
    );
    this.name = 'InvalidLicenseError';
  }
}

/**
 * User exceeded usage quota (future: usage-based billing)
 */
export class QuotaExceededError extends VPAError {
  constructor(quotaType: string, limit: number) {
    super(
      `User exceeded quota: ${quotaType} (limit: ${limit})`,
      `You've reached your monthly ${quotaType} limit (${limit}). Upgrade for higher limits.`,
      'QUOTA_EXCEEDED',
      'https://yourapp.com/pricing',
      429
    );
    this.name = 'QuotaExceededError';
  }
}

/**
 * Database connection or query error
 */
export class DatabaseError extends VPAError {
  constructor(operation: string, originalError: Error) {
    super(
      `Database error during ${operation}: ${originalError.message}`,
      'A database error occurred. Please try again. If the problem persists, contact support.',
      'DATABASE_ERROR',
      undefined,
      500
    );
    this.name = 'DatabaseError';
  }
}

/**
 * Invalid tool parameters
 */
export class InvalidParametersError extends VPAError {
  constructor(paramName: string, reason: string) {
    super(
      `Invalid parameter '${paramName}': ${reason}`,
      `Invalid parameter: ${paramName}. ${reason}`,
      'INVALID_PARAMETERS',
      undefined,
      400
    );
    this.name = 'InvalidParametersError';
  }
}

/**
 * Module not found in registry
 */
export class ModuleNotFoundError extends VPAError {
  constructor(moduleId: string) {
    super(
      `Module '${moduleId}' not found in registry`,
      `Unknown module: ${moduleId}. Please contact support.`,
      'MODULE_NOT_FOUND',
      undefined,
      404
    );
    this.name = 'ModuleNotFoundError';
  }
}

/**
 * Tool not found in module
 */
export class ToolNotFoundError extends VPAError {
  constructor(toolName: string, moduleId: string) {
    super(
      `Tool '${toolName}' not found in module '${moduleId}'`,
      `Unknown tool: ${toolName}. Please check your command.`,
      'TOOL_NOT_FOUND',
      undefined,
      404
    );
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Configuration error (missing env vars, etc.)
 */
export class ConfigurationError extends VPAError {
  constructor(configKey: string, reason: string) {
    super(
      `Configuration error: ${configKey} - ${reason}`,
      'VPA is not configured correctly. Please contact support.',
      'CONFIGURATION_ERROR',
      undefined,
      500
    );
    this.name = 'ConfigurationError';
  }
}

/**
 * User account suspended or cancelled
 */
export class AccountSuspendedError extends VPAError {
  constructor(reason?: string) {
    super(
      `Account suspended: ${reason || 'unknown'}`,
      'Your account has been suspended. Please contact support.',
      'ACCOUNT_SUSPENDED',
      'https://yourapp.com/support',
      403
    );
    this.name = 'AccountSuspendedError';
  }
}

/**
 * Helper function to check if error is a VPA error
 */
export function isVPAError(error: unknown): error is VPAError {
  return error instanceof VPAError;
}

/**
 * Helper function to format error for MCP response
 */
export function formatErrorForMCP(error: unknown): {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
} {
  if (isVPAError(error)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(error.toJSON(), null, 2)
        }
      ],
      isError: true
    };
  }

  // Generic error
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: 'An unexpected error occurred. Please try again or contact support.',
          errorCode: 'INTERNAL_ERROR'
        }, null, 2)
      }
    ],
    isError: true
  };
}
