import { pluralCategory, relativeUpdateKey, riyadhTime } from './format';

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
