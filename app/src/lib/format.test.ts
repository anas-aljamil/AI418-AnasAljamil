import { createInstance } from 'i18next';

import en from '@/i18n/en.json';
import ar from '@/i18n/ar.json';
import { isUniversityEmail, universityNumberOf } from '@/lib/validation';
import {
  appointmentDay,
  bookingDays,
  countdownKey,
  daysText,
  durationText,
  timeOfDay,
  greetingKey,
  pluralCategory,
  relativeUpdateKey,
  riyadhDayDifference,
  riyadhTime,
  clockText,
  laterText,
  untilText,
} from './format';

const resources = { ar: { translation: ar }, en: { translation: en } };

describe('Arabic plural categories (CLDR)', () => {
  it.each([
    [1, 'one'],
    [2, 'two'],
    [3, 'few'],
    [10, 'few'],
    [11, 'many'],
    [59, 'many'],
    [0, 'other'],
    [100, 'other'],
    [103, 'few'],
    [111, 'many'],
  ])('%i -> %s', (n, category) => {
    expect(pluralCategory('ar', n)).toBe(category);
  });

  it('English uses one / two / other', () => {
    expect([1, 2, 3, 11].map((n) => pluralCategory('en', n))).toEqual([
      'one',
      'two',
      'other',
      'other',
    ]);
  });
});

describe('"updated X ago"', () => {
  const now = new Date('2026-10-05T07:00:00Z');
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);

  it('picks the unit and the Arabic plural form', () => {
    expect(relativeUpdateKey('ar', ago(0.5), now)).toEqual({ key: 'time.just_now', count: 0 });
    expect(relativeUpdateKey('ar', ago(2), now)).toEqual({ key: 'time.minutes_two', count: 2 });
    expect(relativeUpdateKey('ar', ago(3), now)).toEqual({ key: 'time.minutes_few', count: 3 });
    expect(relativeUpdateKey('ar', ago(15), now)).toEqual({ key: 'time.minutes_many', count: 15 });
    expect(relativeUpdateKey('ar', ago(60), now)).toEqual({ key: 'time.hours_one', count: 1 });
    expect(relativeUpdateKey('ar', ago(300), now)).toEqual({ key: 'time.hours_few', count: 5 });
    expect(relativeUpdateKey('ar', ago(60 * 24 * 2), now)).toEqual({
      key: 'time.days_two',
      count: 2,
    });
  });

  it('never goes negative when the clock is slightly behind the server', () => {
    expect(relativeUpdateKey('en', new Date(now.getTime() + 30000), now).key).toBe('time.just_now');
  });
});

describe('Riyadh time', () => {
  it('formats UTC as Riyadh HH:MM with Western digits', () => {
    expect(riyadhTime(new Date('2026-10-11T07:30:00Z'))).toBe('10:30');
    expect(riyadhTime(new Date('2026-10-05T21:05:00Z'))).toBe('00:05');
  });
});

describe('Riyadh days, greetings and countdowns', () => {
  // Monday 2026-10-05 10:00 in Riyadh.
  const now = new Date('2026-10-05T07:00:00Z');

  it('counts calendar days in Riyadh, not in UTC', () => {
    // 22:30 UTC on Monday is already 01:30 on Tuesday in Riyadh.
    expect(riyadhDayDifference(new Date('2026-10-05T22:30:00Z'), now)).toBe(1);
    expect(riyadhDayDifference(new Date('2026-10-05T20:59:00Z'), now)).toBe(0);
  });

  it('greets by the time of day in Riyadh', () => {
    expect(greetingKey(new Date('2026-10-05T03:00:00Z'))).toBe('greeting.morning'); // 06:00
    expect(greetingKey(new Date('2026-10-05T10:00:00Z'))).toBe('greeting.afternoon'); // 13:00
    expect(greetingKey(new Date('2026-10-05T16:00:00Z'))).toBe('greeting.evening'); // 19:00
  });

  it('names the day of an appointment: today, tomorrow or the weekday', () => {
    expect(appointmentDay(new Date('2026-10-05T09:30:00Z'), now)).toEqual({
      key: 'when.today',
      time: '12:30',
      weekday: 1,
    });
    expect(appointmentDay(new Date('2026-10-06T06:00:00Z'), now).key).toBe('when.tomorrow');
    expect(appointmentDay(new Date('2026-10-11T07:30:00Z'), now)).toEqual({
      key: 'when.weekday',
      time: '10:30',
      weekday: 0, // Sunday
    });
  });

  it('counts down in minutes, hours, then calendar days, with Arabic plural forms', () => {
    expect(countdownKey('ar', new Date('2026-10-05T07:00:30Z'), now).key).toBe('countdown.now');
    expect(countdownKey('ar', new Date('2026-10-05T07:25:00Z'), now)).toEqual({
      key: 'countdown.minutes_many',
      count: 25,
    });
    expect(countdownKey('ar', new Date('2026-10-05T10:00:00Z'), now)).toEqual({
      key: 'countdown.hours_few',
      count: 3,
    });
    expect(countdownKey('ar', new Date('2026-10-11T07:30:00Z'), now)).toEqual({
      key: 'countdown.days_few',
      count: 6,
    });
  });
});

describe('booking days (this week and next, Sunday to Thursday)', () => {
  const dates = (now: string) => bookingDays(new Date(now)).map((d) => d.date);

  it('on a Monday: the rest of this week, then all of next week', () => {
    expect(dates('2026-10-05T07:00:00Z')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('on a Friday: next week only', () => {
    expect(dates('2026-10-09T07:00:00Z')).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('uses the Riyadh date: 22:00 UTC on Thursday is already Friday', () => {
    expect(dates('2026-10-08T22:00:00Z')[0]).toBe('2026-10-11');
  });
});

describe('12-hour clock (owner decision)', () => {
  // A minimal t() over the real string files, enough for the clock keys.
  const tFor = (strings: typeof en) =>
    ((key: string, values?: Record<string, string>) => {
      const template = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], strings);
      return String(template).replace(/{{(\w+)}}/g, (_, name: string) => values?.[name] ?? '');
    }) as unknown as Parameters<typeof clockText>[1];

  it.each([
    ['00:15', '12:15 AM', '12:15 ص'],
    ['09:30', '9:30 AM', '9:30 ص'],
    ['12:00', '12:00 PM', '12:00 م'],
    ['13:45:00', '1:45 PM', '1:45 م'],
    ['23:00', '11:00 PM', '11:00 م'],
  ])('%s reads %s / %s', (hhmm, english, arabic) => {
    expect(clockText(hhmm, tFor(en))).toBe(english);
    expect(clockText(hhmm, tFor(ar))).toBe(arabic);
  });
});

describe('lengths and days for the schedule', () => {
  // Real i18next, because the lengths use Arabic plural forms (ساعتان, 3 ساعات, 12 ساعة).
  const tIn = async (language: 'ar' | 'en') => {
    const instance = createInstance();
    await instance.init({ resources, lng: language, interpolation: { escapeValue: false } });
    return instance.t.bind(instance) as Parameters<typeof durationText>[1];
  };

  it.each([
    [45, '45 minutes', '45 دقيقة'],
    [60, '1 hour', 'ساعة'],
    [90, '1 hour 30 minutes', 'ساعة و30 دقيقة'],
    [120, '2 hours', 'ساعتان'],
    [180, '3 hours', '3 ساعات'],
    [720, '12 hours', '12 ساعة'],
  ])('%i minutes read %s / %s', async (minutes, english, arabic) => {
    expect(durationText(minutes, await tIn('en'))).toBe(english);
    expect(durationText(minutes, await tIn('ar'))).toBe(arabic);
  });

  it.each([
    [[4, 0, 2], 'Sunday, Tuesday and Thursday', 'الأحد والثلاثاء والخميس'],
    [[1], 'Monday', 'الاثنين'],
    [[0, 1, 2, 3, 4], 'Sunday to Thursday', 'من الأحد إلى الخميس'],
    [[0, 1, 2, 3, 4, 5, 6], 'Every day', 'كل يوم'],
  ])('days %j read %s / %s', async (days, english, arabic) => {
    expect(daysText(days, await tIn('en'))).toBe(english);
    expect(daysText(days, await tIn('ar'))).toBe(arabic);
  });

  it('wraps a time past midnight', () => {
    expect([0, 75, 1440 + 60, -15].map(timeOfDay)).toEqual(['00:00', '01:15', '01:00', '23:45']);
  });
});

describe('status end', () => {
  const t = ((key: string, values?: Record<string, string>) =>
    key === 'prof.until'
      ? `until ${values?.time}`
      : key === 'time.clock'
        ? `${values?.time} ${values?.period}`
        : key.endsWith('am')
          ? 'AM'
          : key.endsWith('pm')
            ? 'PM'
            : key) as unknown as Parameters<typeof untilText>[1];

  it('names the return time on the 12-hour clock', () => {
    expect(untilText(new Date('2026-10-05T08:30:00Z'), t)).toBe('until 11:30 AM');
  });

  it('says "the rest of today" for a status that ends at Riyadh midnight', () => {
    expect(untilText(new Date('2026-10-05T21:00:00Z'), t)).toBe('prof.until_end_of_day');
  });
});

describe('a later time inside a sentence', () => {
  const t = ((key: string, values?: Record<string, string>) =>
    key === 'when.weekday'
      ? `${values?.day} ${values?.time}`
      : key === 'time.clock'
        ? `${values?.time} ${values?.period}`
        : key.endsWith('am')
          ? 'AM'
          : key.endsWith('pm')
            ? 'PM'
            : key === 'weekday.6'
              ? 'Saturday'
              : key) as unknown as Parameters<typeof laterText>[2];
  const now = new Date('2026-10-05T07:00:00Z'); // Monday 10:00 Riyadh

  it('gives the time alone later today', () => {
    expect(laterText(new Date('2026-10-05T09:00:00Z'), now, t)).toBe('12:00 PM');
  });

  it('adds the weekday for another day (never "Tomorrow" mid-sentence)', () => {
    expect(laterText(new Date('2026-10-09T21:00:00Z'), now, t)).toBe('Saturday 12:00 AM');
  });
});

describe('university email', () => {
  it('reads the university number from a student address', () => {
    expect(universityNumberOf('1234567@upm.edu.sa')).toBe('1234567');
    expect(universityNumberOf('r.alqahtani@upm.edu.sa')).toBeNull();
    expect(universityNumberOf('1234567@gmail.com')).toBeNull();
    expect(universityNumberOf('1234567@evil.upm.edu.sa')).toBeNull();
  });

  it('accepts only the university domain', () => {
    expect(isUniversityEmail('m.alfaraj@upm.edu.sa')).toBe(true);
    expect(isUniversityEmail('m.alfaraj@upm.edu.sa.evil.com')).toBe(false);
    expect(isUniversityEmail('m.alfaraj@evil-upm.edu.sa')).toBe(false);
  });
});
