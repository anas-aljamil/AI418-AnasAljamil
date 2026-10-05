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
