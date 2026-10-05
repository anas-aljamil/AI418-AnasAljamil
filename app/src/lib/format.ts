/**
 * Language-aware formatting that does not depend on the device's Intl support
 * (Hermes on Android, iOS and browsers differ). Digits are always Western 0-9.
 */
import type { Language } from '@/theme/tokens';

export type PluralCategory = 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * CLDR plural categories. Arabic: 1 one, 2 two, n%100 in 3..10 few,
 * n%100 in 11..99 many, everything else (0, 100, 101, ...) other.
 * English keeps "two" so 2 can still read naturally ("2 min").
 */
export function pluralCategory(language: Language, n: number): PluralCategory {
  if (language === 'en') return n === 1 ? 'one' : n === 2 ? 'two' : 'other';
  const mod100 = n % 100;
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  if (mod100 >= 11 && mod100 <= 99) return 'many';
  return 'other';
}

/** i18n key and count for "updated X ago", given two instants. */
export function relativeUpdateKey(
  language: Language,
  updated: Date,
  now: Date,
): { key: string; count: number } {
  const minutes = Math.max(0, Math.floor((now.getTime() - updated.getTime()) / 60000));
  if (minutes < 1) return { key: 'time.just_now', count: 0 };
  if (minutes < 60)
    return { key: `time.minutes_${pluralCategory(language, minutes)}`, count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: `time.hours_${pluralCategory(language, hours)}`, count: hours };
  const days = Math.floor(hours / 24);
  return { key: `time.days_${pluralCategory(language, days)}`, count: days };
}

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000; // Asia/Riyadh is UTC+03:00 with no daylight saving

/** "HH:MM" in Riyadh time, Western digits, for any UTC instant. */
export function riyadhTime(utc: Date): string {
  const local = new Date(utc.getTime() + RIYADH_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function riyadhLocal(utc: Date): Date {
  return new Date(utc.getTime() + RIYADH_OFFSET_MS);
}

/** Calendar days between two instants in Riyadh (0 = same day, 1 = tomorrow). */
export function riyadhDayDifference(target: Date, now: Date): number {
  const day = (d: Date) => Math.floor(riyadhLocal(d).getTime() / 86_400_000);
  return day(target) - day(now);
}

/** Greeting by Riyadh time of day: morning 04:00-11:59, afternoon 12:00-16:59, evening otherwise. */
export function greetingKey(now: Date): string {
  const hour = riyadhLocal(now).getUTCHours();
  if (hour >= 4 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 17) return 'greeting.afternoon';
  return 'greeting.evening';
}

/** "Today 10:30", "Tomorrow 10:30" or "Sunday 10:30" as an i18n key with its values. */
export function appointmentDay(
  start: Date,
  now: Date,
): { key: string; time: string; weekday: number } {
  const difference = riyadhDayDifference(start, now);
  const weekday = riyadhLocal(start).getUTCDay(); // 0 = Sunday
  const key = difference === 0 ? 'when.today' : difference === 1 ? 'when.tomorrow' : 'when.weekday';
  return { key, time: riyadhTime(start), weekday };
}

/** "in 25 min", "in 3 hours", "in 6 days" (calendar days once it is not today). */
export function countdownKey(
  language: Language,
  start: Date,
  now: Date,
): { key: string; count: number } {
  const minutes = Math.floor((start.getTime() - now.getTime()) / 60000);
  if (minutes < 1) return { key: 'countdown.now', count: 0 };
  const days = riyadhDayDifference(start, now);
  if (days >= 1) return { key: `countdown.days_${pluralCategory(language, days)}`, count: days };
  if (minutes < 60)
    return { key: `countdown.minutes_${pluralCategory(language, minutes)}`, count: minutes };
  const hours = Math.floor(minutes / 60);
  return { key: `countdown.hours_${pluralCategory(language, hours)}`, count: hours };
}
