import { ApiError } from '@/api/client';

/** API error codes with their own message in the string files (errors.*). */
const KNOWN = ['INVALID_CREDENTIALS', 'ACCOUNT_DISABLED', 'RATE_LIMITED', 'NETWORK'];

/** The i18n key that says what happened and how to fix it (DESIGN.md Section 8). */
export function errorKey(error: unknown): string {
  return error instanceof ApiError && KNOWN.includes(error.code)
    ? `errors.${error.code}`
    : 'errors.generic';
}
