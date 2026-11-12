/**
 * Weekly ranges as minutes of the Riyadh week (0 = Sunday 00:00, 10079 = Saturday 23:59), for
 * the schedule views: what is going on now, what comes next, and how a range that runs past
 * midnight splits over two days. Ranges repeat every week, so the week wraps around.
 */
import { minutesOfDay } from '@/lib/format';

export const DAY = 24 * 60;
export const WEEK = 7 * DAY;

export interface WeekRange {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** Minutes of the Riyadh week for an instant. */
export function weekMinute(now: Date): number {
  const riyadh = new Date(now.getTime() + 3 * 60 * 60_000);
  return riyadh.getUTCDay() * DAY + minutesOfDay(now);
}

/** Start and length in minutes; an end at or before the start runs into the next day. */
export function span(range: WeekRange, overnight: boolean): { start: number; length: number } {
  const start = minutesOfDay(range.start_time);
  let length = minutesOfDay(range.end_time) - start;
  if (overnight && length <= 0) length += DAY;
  return { start, length };
}

/** Each range as [from, to) in week minutes; `to` may pass the end of the week (it wraps). */
function intervals(ranges: WeekRange[], overnight: boolean): [number, number][] {
  return ranges
    .map((range) => {
      const { start, length } = span(range, overnight);
      const from = range.day_of_week * DAY + start;
      return [from, from + length] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
}

/** Back-to-back or overlapping ranges joined into stretches, wrapping around the week. */
export function stretches(ranges: WeekRange[], overnight: boolean): [number, number][] {
  const merged: [number, number][] = [];
  for (const [from, to] of intervals(ranges, overnight)) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  // A stretch that runs past Saturday night may join the first one on Sunday.
  const first = merged[0];
  const last = merged[merged.length - 1];
  if (merged.length > 1 && first && last && last[1] - WEEK >= first[0]) {
    last[1] = Math.max(last[1], first[1] + WEEK);
    merged.shift();
  }
  return merged;
}

/** The stretch going on at a week minute, if any, as [from, to) shifted to contain `at`. */
export function current(ranges: WeekRange[], overnight: boolean, at: number) {
  for (const [from, to] of stretches(ranges, overnight)) {
    for (const shift of [0, -WEEK, WEEK]) {
      if (from + shift <= at && at < to + shift) return { from: from + shift, to: to + shift };
    }
  }
  return null;
}

/** Minutes from `at` until the next range starts (0 to one week), or null without ranges. */
export function untilNext(ranges: WeekRange[], overnight: boolean, at: number): number | null {
  const starts = stretches(ranges, overnight).map(([from]) => from);
  if (starts.length === 0) return null;
  return Math.min(...starts.map((from) => (((from - at) % WEEK) + WEEK) % WEEK));
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
