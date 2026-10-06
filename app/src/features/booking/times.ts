/**
 * Free booking (CLAUDE.md Section 4): a start on any 5-minute step inside office hours and
 * any length in 5-minute steps that fits before the next booking or the end of the block.
 * The API gives every start with its longest free length; these helpers shape that list.
 */
import type { Slot } from '@/api/types';
import { addMinutes } from '@/lib/format';

export const STEP = 5;
/** One-tap lengths, shown when they fit. */
export const QUICK_LENGTHS = [10, 15, 20, 30, 45, 60];

/** The hours (0-23) that have starts, in order. */
export function hoursOf(slots: Slot[]): number[] {
  return [...new Set(slots.map((s) => Number(s.local_time.slice(0, 2))))];
}

/** The free stretches of the day, "HH:MM" to "HH:MM" (Riyadh), for the summary line. */
export function freeWindows(slots: Slot[]): { start: string; end: string }[] {
  const windows: { start: string; end: string }[] = [];
  for (const slot of slots) {
    if (!slot.available) continue;
    const end = addMinutes(slot.local_time, slot.max_minutes);
    const last = windows[windows.length - 1];
    // Starts in one free stretch all reach the same end (the next booking or the block's end).
    if (last && last.end === end) continue;
    windows.push({ start: slot.local_time, end });
  }
  return windows;
}

/** A length that fits: whole 5-minute steps between 5 and the longest free length. */
export function fitLength(minutes: number, max: number): number {
  const stepped = Math.round(minutes / STEP) * STEP;
  return Math.max(STEP, Math.min(stepped, max));
}
