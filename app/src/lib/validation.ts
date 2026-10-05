/**
 * Client-side checks that mirror the API's rules (backend/app/schemas.py), so mistakes show
 * next to the field before anything is sent. The API still validates everything.
 */

/** "HH:MM" on the 15-minute grid used by schedules. */
export const isQuarterHour = (value: string) => /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);

export const patterns = {
  departmentCode: /^[A-Z]{2,10}$/,
  building: /^[A-Z0-9]{1,10}$/,
  room: /^[A-Z0-9-]{1,10}$/,
  email: /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/,
  universityNo: /^[A-Z0-9]{4,12}$/,
};
