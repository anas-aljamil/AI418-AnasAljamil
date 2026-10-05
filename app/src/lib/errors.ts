import { ApiError } from '@/api/client';

/** API error codes with their own message in the string files (errors.*). */
const KNOWN = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'RATE_LIMITED',
  'NETWORK',
  'SLOT_TAKEN',
  'SLOT_IN_PAST',
  'BOOKING_LIMIT',
  'OUTSIDE_BOOKING_WINDOW',
  'INVALID_SLOT',
  'CANCEL_WINDOW_CLOSED',
  'INVALID_TRANSITION',
  'TOO_EARLY',
  'SCHEDULE_OVERLAP',
  'INVALID_RETURN_TIME',
  'CONFLICT',
  'IN_USE',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'FORBIDDEN',
  'EMAIL_TAKEN',
  'UNIVERSITY_NO_TAKEN',
  'EMAIL_DOMAIN',
  'INVALID_REFERENCE',
];

/** The i18n key that says what happened and how to fix it (DESIGN.md Section 8). */
export function errorKey(error: unknown): string {
  return error instanceof ApiError && KNOWN.includes(error.code)
    ? `errors.${error.code}`
    : 'errors.generic';
}
