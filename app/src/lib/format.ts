/**
 * Language-aware formatting that does not depend on the device's Intl support
 * (Hermes on Android, iOS and browsers differ). Digits are always Western 0-9.
 */
import type { TFunction } from 'i18next';

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

/**
 * What people read: the 12-hour clock with the period in the UI language, "9:30 AM" or
 * "9:30 ص" (owner decision; Western digits). Takes "HH:MM" or "HH:MM:SS" (24-hour).
 */
export function clockText(hhmm: string, t: TFunction): string {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return t('time.clock', {
    time: `${hour12}:${String(minutes).padStart(2, '0')}`,
    period: t(hours < 12 ? 'time.am' : 'time.pm'),
  });
}

/**
 * "until 11:30 AM", or "for the rest of today" when the status ends at Riyadh midnight (a
 * manual status without a return time), which "until 12:00 AM" would say confusingly.
 */
export function untilText(until: Date, t: TFunction): string {
  const time = riyadhTime(until);
  return time === '00:00'
    ? t('prof.until_end_of_day')
    : t('prof.until', { time: clockText(time, t) });
}

/** "HH:MM" (24-hour) in Riyadh time for any UTC instant; for logic and keys. Show it with clockText. */
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

/** "2026-10-11": the Riyadh calendar date of an instant (the API's `date` parameter). */
export function riyadhDateKey(utc: Date): string {
  return riyadhLocal(utc).toISOString().slice(0, 10);
}

/** Minutes since Riyadh midnight for an instant, or for an "HH:MM" schedule time. */
/** "HH:MM" plus some minutes, as "HH:MM" (same day). */
export function addMinutes(hhmm: string, minutes: number): string {
  const total = minutesOfDay(hhmm) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** A whole hour on the 12-hour clock without minutes: "10 AM" / "10 ص". */
export function hourText(hour: number, t: TFunction): string {
  return t('time.hour', {
    hour: hour % 12 === 0 ? 12 : hour % 12,
    period: t(hour < 12 ? 'time.am' : 'time.pm'),
  });
}

export function minutesOfDay(at: Date | string): number {
  if (typeof at === 'string') {
    const [h = '0', m = '0'] = at.split(':');
    return Number(h) * 60 + Number(m);
  }
  const local = riyadhLocal(at);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export interface BookingDay {
  date: string; // YYYY-MM-DD in Riyadh
  weekday: number; // 0 = Sunday
  dayOfMonth: number;
}

/**
 * The days a student can book (DESIGN.md 7.5, CLAUDE.md Section 14): working days
 * (Sunday-Thursday) from today until the Riyadh midnight that starts the Sunday after next.
 */
export function bookingDays(now: Date): BookingDay[] {
  const today = riyadhLocal(now);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const weekStart = start - today.getUTCDay() * 86_400_000;
  const days: BookingDay[] = [];
  for (let at = start; at < weekStart + 14 * 86_400_000; at += 86_400_000) {
    const day = new Date(at);
    if (day.getUTCDay() <= 4) {
      days.push({
        date: day.toISOString().slice(0, 10),
        weekday: day.getUTCDay(),
        dayOfMonth: day.getUTCDate(),
      });
    }
  }
  return days;
}

/** "Today 10:30 AM", "Tomorrow 10:30 AM" or "Sunday 10:30 AM" for an instant, in the UI language. */
export function whenText(start: Date, now: Date, t: TFunction): string {
  const day = appointmentDay(start, now);
  return t(day.key, { time: clockText(day.time, t), day: t(`weekday.${day.weekday}`) });
}

/** "Sunday 4/10 10:30 AM": weekday, day/month and Riyadh time, for dates outside the two weeks. */
export function dateTimeText(start: Date, t: TFunction): string {
  const local = riyadhLocal(start);
  return `${t(`weekday.${local.getUTCDay()}`)} ${local.getUTCDate()}/${local.getUTCMonth() + 1} ${clockText(riyadhTime(start), t)}`;
}

/** Short time for lists: "10:30 AM" today, otherwise "Sun 4/10" (weekday short, day/month). */
export function shortWhen(at: Date, now: Date, t: TFunction): string {
  if (riyadhDayDifference(at, now) === 0) return clockText(riyadhTime(at), t);
  const local = riyadhLocal(at);
  return `${t(`weekday_short.${local.getUTCDay()}`)} ${local.getUTCDate()}/${local.getUTCMonth() + 1}`;
}
