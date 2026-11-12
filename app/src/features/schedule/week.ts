/**
 * Times as minutes of the Riyadh week (0 = Sunday 00:00), for the schedule views: what is going
 * on now, what comes next, and how a range that runs past midnight splits over two days. Rows
 * are weekly or dated with skipped dates (lib/dates.ts), so "now" and "next" look at the
 * actual dates from yesterday to a week ahead; minutes past Saturday night keep counting.
 */
import type { Repeats } from '@/api/types';
import { addDays, occursOn, todayKey, weekdayOf } from '@/lib/dates';
import { minutesOfDay } from '@/lib/format';

export const DAY = 24 * 60;

export interface WeekRange {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** A weekly or dated row with its times. */
export interface DatedRange extends Repeats {
  start_time: string;
  end_time: string;
}

/** Minutes of the Riyadh week for an instant. */
export function weekMinute(now: Date): number {
  const riyadh = new Date(now.getTime() + 3 * 60 * 60_000);
  return riyadh.getUTCDay() * DAY + minutesOfDay(now);
}

/** Start and length in minutes; an end at or before the start runs into the next day. */
export function span(
  range: Pick<WeekRange, 'start_time' | 'end_time'>,
  overnight: boolean,
): { start: number; length: number } {
  const start = minutesOfDay(range.start_time);
  let length = minutesOfDay(range.end_time) - start;
  if (overnight && length <= 0) length += DAY;
  return { start, length };
}

/**
 * Every occurrence from yesterday to a week ahead as [from, to) in minutes from the Sunday of
 * this week (yesterday may be negative), with back-to-back and overlapping ones joined.
 */
export function stretches(ranges: DatedRange[], overnight: boolean, now: Date): [number, number][] {
  const today = todayKey(now);
  const base = weekdayOf(today) * DAY;
  const found: [number, number][] = [];
  for (let offset = -1; offset <= 7; offset++) {
    const date = addDays(today, offset);
    for (const range of ranges) {
      if (!occursOn(range, date)) continue;
      const { start, length } = span(range, overnight);
      const from = base + offset * DAY + start;
      found.push([from, from + length]);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of found) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

/** The stretch going on at a week minute, if any. */
export function current(stretched: [number, number][], at: number) {
  const hit = stretched.find(([from, to]) => from <= at && at < to);
  return hit ? { from: hit[0], to: hit[1] } : null;
}

/** Minutes from `at` until the next stretch starts (within a week), or null when none does. */
export function untilNext(stretched: [number, number][], at: number): number | null {
  const ahead = stretched.filter(([from]) => from > at).map(([from]) => from - at);
  return ahead.length ? Math.min(...ahead) : null;
}

/** The parts of a range per day: one, or two when it runs past midnight (end of day, then the next). */
export function dayParts(
  range: WeekRange,
  overnight: boolean,
): { day: number; from: number; to: number }[] {
  const { start, length } = span(range, overnight);
  if (start + length <= DAY) return [{ day: range.day_of_week, from: start, to: start + length }];
  return [
    { day: range.day_of_week, from: start, to: DAY },
    { day: (range.day_of_week + 1) % 7, from: 0, to: start + length - DAY },
  ];
}

/** Minutes two same-day ranges share. */
export function overlap(a: { from: number; to: number }, b: { from: number; to: number }): number {
  return Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));
}
