import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { resolveUserId } from '../utils/config.js';

export function ensureUserId(value?: string | null): string {
  try {
    return resolveUserId(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'userId is required';
    throw new McpError(ErrorCode.InvalidParams, message);
  }
}
