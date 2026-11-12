/**
 * Calendar dates as "YYYY-MM-DD" keys in Riyadh (the API's DATE values), and whether a weekly
 * or dated row happens on one (owner decision 2026-11-11, the same rule as the API's
 * services/occurrence.py): weekly on day_of_week until ends_on, or once on on_date; never on
 * one of its skipped dates.
 */
import type { TFunction } from 'i18next';

import { riyadhDateKey } from './format';

export interface When {
  day_of_week: number | null;
  on_date: string | null;
  ends_on: string | null;
  skipped_dates: string[];
}

const DAY_MS = 86_400_000;

/** Today's date key in Riyadh. */
export function todayKey(now: Date): string {
  return riyadhDateKey(now);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from one date key to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS,
  );
}

/** as_pattern: a weekly row on its weekday, ignoring its end date and skipped dates. */
export function occursOn(item: When, date: string, asPattern = false): boolean {
  if (item.on_date !== null) return item.on_date === date && !item.skipped_dates.includes(date);
  if (weekdayOf(date) !== item.day_of_week) return false;
  if (asPattern) return true;
  return (item.ends_on === null || date <= item.ends_on) && !item.skipped_dates.includes(date);
}

/** "Thursday 8 October" / "الخميس 8 أكتوبر". */
export function dateText(date: string, t: TFunction): string {
  const [, month, day] = date.split('-').map(Number);
  return t('dates.full', {
    weekday: t(`weekday.${weekdayOf(date)}`),
    day,
    month: t(`month.${month}`),
  });
}

/** "8 October" / "8 أكتوبر". */
export function shortDateText(date: string, t: TFunction): string {
  const [, month, day] = date.split('-').map(Number);
  return t('dates.short', { day, month: t(`month.${month}`) });
}
