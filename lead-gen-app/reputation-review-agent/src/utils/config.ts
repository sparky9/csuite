import process from 'node:process';

export function resolveUserId(provided?: string | null): string {
  const normalized = (provided ?? process.env.REPUTATION_DEFAULT_USER_ID ?? '').trim();
  if (!normalized) {
    throw new Error('userId is required. Configure REPUTATION_DEFAULT_USER_ID or pass userId explicitly.');
  }
  return normalized;
}
