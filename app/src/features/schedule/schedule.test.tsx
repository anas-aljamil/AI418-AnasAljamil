/**
 * Booking times and closed message hours (owner decisions 2026-11-07): how a range reads
 * (overnight, until midnight, all day), what holds now, and the sheets that add one: several
 * days at once, a start and a length, each from a menu (2026-11-11).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, api } from '@/api/client';
import { renderWithProviders } from '@/test-utils';
import i18n from '@/i18n';
import { addDays, dateText, todayKey, weekdayOf } from '@/lib/dates';
import { nowLine, rangeLine, WeeklyRanges } from './WeeklyRanges';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 100, offset: 0 });

// A weekly row with no end date or skipped dates.
const weekly = { on_date: null, ends_on: null, skipped_dates: [] };

beforeEach(() => mockApi.mockReset());

/** Opens a menu field by its label and picks an option (on phones the menu is a sheet). */
async function choose(field: string, option: string) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${field}, `) }));
  await fireEvent.press(screen.getByRole('radio', { name: option }));
}

it('says how each kind of closed range reads', async () => {
  await renderWithProviders(<></>);
  const t = i18n.t.bind(i18n);
  const line = (start_time: string, end_time: string) => rangeLine({ start_time, end_time }, t);
  expect(line('10:00', '12:00')).toBe('10:00 AM–12:00 PM');
  expect(line('20:00', '08:00')).toBe('8:00 PM to 8:00 AM the next day');
  expect(line('16:00', '00:00')).toBe('4:00 PM until midnight');
  expect(line('00:00', '00:00')).toBe('All day');
});

it('lists booking times by day and warns when there are none', async () => {
  mockApi.mockResolvedValue(page([]));
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  expect(
    await screen.findByText('No booking times yet, so students cannot book you.'),
  ).toBeTruthy();
  expect(screen.queryByText('Saturday')).toBeNull(); // booking times are Sunday-Thursday
});

const posts = (path: string) =>
  mockApi.mock.calls.filter(([called, method]) => called === path && method === 'POST');

it('adds one booking time to the whole working week in a few taps', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET') =>
    method === 'POST' ? {} : page([]),
  );
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  await fireEvent.press(await screen.findByText('Sunday to Thursday'));
  await choose('Start', '9:00 AM');
  await choose('Length', '2 hours, until 11:00 AM');
  expect(screen.getByText('Sunday to Thursday, 9:00 AM–11:00 AM')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save booking time'));
  await waitFor(() => expect(posts('/me/booking-periods')).toHaveLength(5));
  expect(posts('/me/booking-periods').map(([, , body]) => body)).toEqual(
    [0, 1, 2, 3, 4].map((day) => ({
      day_of_week: day,
      on_date: null,
      ends_on: null,
      start_time: '09:00',
      end_time: '11:00',
    })),
  );
});

it('keeps the start and moves the end when the length changes, never past the day', async () => {
  mockApi.mockResolvedValue(page([]));
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  // The default is 10:00 AM for an hour; 1 hour 15 minutes ends at 11:15 AM.
  await choose('Length', '1 hour 15 minutes, until 11:15 AM');
  // A start at 9 PM keeps the length; nothing longer than 2 hours 45 minutes fits the day.
  await choose('Start', '9:00 PM');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Length, 1 hour 15 minutes, until 10:15 PM' }),
  );
  expect(screen.getByRole('radio', { name: '2 hours 45 minutes, until 11:45 PM' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: /^3 hours/ })).toBeNull();
});

it('says which day failed, saves the others and keeps only the failed day', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET', body?: unknown) => {
    if (method !== 'POST') return page([]);
    if ((body as { day_of_week: number }).day_of_week === 2)
      throw new ApiError(409, 'BOOKING_PERIOD_OVERLAP', 'overlap');
    return {};
  });
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  // The day headings of the list also say "Tuesday"; the sheet's chip comes last.
  await fireEvent.press((await screen.findAllByText('Tuesday')).at(-1)!);
  await fireEvent.press(screen.getByText('Save booking time'));
  expect(
    await screen.findByText(
      'Not saved for Tuesday: This booking time overlaps another booking time on the same day.',
    ),
  ).toBeTruthy();
  expect(posts('/me/booking-periods')).toHaveLength(2); // Sunday saved, Tuesday refused
  expect(screen.getByText('Tuesday, 10:00 AM–11:00 AM')).toBeTruthy();
});

it('asks for a day when none is chosen', async () => {
  mockApi.mockResolvedValue(page([]));
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  // The only day chosen (the list's headings also say "Sunday"; the sheet's chip comes last).
  await fireEvent.press((await screen.findAllByText('Sunday')).at(-1)!);
  await fireEvent.press(screen.getByText('Save booking time'));
  expect(await screen.findByText('Choose at least one day.')).toBeTruthy();
  expect(posts('/me/booking-periods')).toHaveLength(0);
});

it('saves overnight closed hours, which may end before they start', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    if (method === 'POST')
      return { ...weekly, closure_id: 9, day_of_week: 0, start_time: '20:00', end_time: '08:00' };
    return page([
      { ...weekly, closure_id: 1, day_of_week: 6, start_time: '00:00', end_time: '00:00' },
    ]);
  });
  await renderWithProviders(<WeeklyRanges kind="chat-closed-hours" />);
  expect(await screen.findByText('All day')).toBeTruthy(); // Saturday, a day off
  await fireEvent.press(screen.getByText('Add closed hours'));
  expect(await screen.findByText('Sunday, 8:00 PM to 8:00 AM the next day')).toBeTruthy();
  expect(screen.getByText('12 hours, until 8:00 AM the next day')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save closed hours'));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/chat-closed-hours', 'POST', {
      day_of_week: 0,
      on_date: null,
      ends_on: null,
      start_time: '20:00',
      end_time: '08:00',
    }),
  );
});

it('closes a whole day as an end equal to the start', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET') =>
    method === 'POST' ? {} : page([]),
  );
  await renderWithProviders(<WeeklyRanges kind="chat-closed-hours" />);
  await fireEvent.press(await screen.findByText('Add closed hours'));
  await choose('Start', '12:00 AM');
  await choose('Length', 'All day');
  expect(screen.getByText('Sunday, All day')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save closed hours'));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/chat-closed-hours', 'POST', {
      day_of_week: 0,
      on_date: null,
      ends_on: null,
      start_time: '00:00',
      end_time: '00:00',
    }),
  );
});

it('says what holds now, across midnight and the end of the week', async () => {
  await renderWithProviders(<></>);
  const t = i18n.t.bind(i18n);
  // Monday 2026-10-05, 10:00 in Riyadh.
  const now = new Date('2026-10-05T07:00:00Z');
  const booking = [
    { ...weekly, day_of_week: 1, start_time: '09:00', end_time: '11:00' },
    { ...weekly, day_of_week: 3, start_time: '12:00', end_time: '13:00' },
  ];
  expect(nowLine('booking-periods', booking, now, t)).toBe(
    'Students can book now, until 11:00 AM.',
  );
  expect(nowLine('booking-periods', booking.slice(1), now, t)).toBe(
    'Next booking time: Wednesday at 12:00 PM.',
  );
  expect(nowLine('booking-periods', [], now, t)).toBe(
    'No booking times yet, so students cannot book you.',
  );
  // Closed from Sunday 8 PM and on Monday morning, back to back: one stretch until noon.
  const closed = [
    { ...weekly, day_of_week: 0, start_time: '20:00', end_time: '08:00' },
    { ...weekly, day_of_week: 1, start_time: '08:00', end_time: '12:00' },
  ];
  expect(nowLine('chat-closed-hours', closed, now, t)).toBe(
    'Messages are closed now, until 12:00 PM.',
  );
  // Saturday night into Sunday wraps around the week.
  const weekend = [{ ...weekly, day_of_week: 6, start_time: '22:00', end_time: '06:00' }];
  expect(nowLine('chat-closed-hours', weekend, now, t)).toBe(
    'Messages are open now, until Saturday at 10:00 PM.',
  );
  expect(nowLine('chat-closed-hours', weekend, new Date('2026-10-04T01:00:00Z'), t)).toBe(
    'Messages are closed now, until 6:00 AM.',
  );
  expect(nowLine('chat-closed-hours', [], now, t)).toBe('Students can write to you at any time.');
});

it('saves closed hours on one date, picked on the calendar', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET') =>
    method === 'POST' ? {} : page([]),
  );
  await renderWithProviders(<WeeklyRanges kind="chat-closed-hours" />);
  await fireEvent.press(await screen.findByText('Add closed hours'));
  await choose('Repeats', 'On one date only');
  // Today is picked first; the next day is one tap on the calendar.
  const tomorrow = addDays(todayKey(new Date()), 1);
  await fireEvent.press(screen.getByRole('radio', { name: dateText(tomorrow, i18n.t.bind(i18n)) }));
  await fireEvent.press(screen.getByText('Save closed hours'));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/chat-closed-hours', 'POST', {
      day_of_week: null,
      on_date: tomorrow,
      ends_on: null,
      start_time: '20:00',
      end_time: '08:00',
    }),
  );
});

it('repeats every week until a last date, and asks for that date first', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET') =>
    method === 'POST' ? {} : page([]),
  );
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  await choose('Repeats', 'Every week until a date');
  await fireEvent.press(screen.getByText('Save booking time'));
  expect(await screen.findByText('Choose the last date.')).toBeTruthy();
  const last = addDays(todayKey(new Date()), 3);
  await fireEvent.press(screen.getByRole('radio', { name: dateText(last, i18n.t.bind(i18n)) }));
  await fireEvent.press(screen.getByText('Save booking time'));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/booking-periods', 'POST', {
      day_of_week: 0,
      on_date: null,
      ends_on: last,
      start_time: '10:00',
      end_time: '11:00',
    }),
  );
});

it('leaves out one date of a saved weekly item and brings it back', async () => {
  const today = todayKey(new Date());
  // A weekly booking time on today's weekday, with next week's date already left out.
  const row = {
    period_id: 4,
    day_of_week: weekdayOf(today) <= 4 ? weekdayOf(today) : 0,
    on_date: null,
    ends_on: null,
    skipped_dates: [] as string[],
    start_time: '10:00',
    end_time: '11:00',
  };
  const nextWeek = addDays(today, 7 + ((row.day_of_week - weekdayOf(today) + 7) % 7));
  row.skipped_dates = [nextWeek];
  mockApi.mockImplementation(async (path: string, method = 'GET') =>
    method === 'GET' ? page([row]) : {},
  );
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByRole('button', { name: /^10:00 AM–11:00 AM, / }));
  const t = i18n.t.bind(i18n);
  await fireEvent.press(
    await screen.findByRole('button', { name: `Bring back ${dateText(nextWeek, t)}` }),
  );
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith(`/me/booking-periods/4/skips/${nextWeek}`, 'DELETE'),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Leave out a date' }));
  const inTwoWeeks = addDays(nextWeek, 7);
  // Only the item's own weekday can be left out.
  expect(
    screen.getByRole('radio', { name: dateText(addDays(inTwoWeeks, 1), t) + ', unavailable' }),
  ).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: dateText(inTwoWeeks, t) }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/booking-periods/4/skips', 'POST', {
      skip_date: inTwoWeeks,
    }),
  );
});

it('counts dated items and left-out dates in what holds now', async () => {
  await renderWithProviders(<></>);
  const t = i18n.t.bind(i18n);
  const now = new Date('2026-10-05T07:00:00Z'); // Monday 10:00 in Riyadh
  const monday = { ...weekly, day_of_week: 1, start_time: '09:00', end_time: '11:00' };
  // The Monday booking time is left out today, so the next one is next Monday.
  expect(nowLine('booking-periods', [{ ...monday, skipped_dates: ['2026-10-05'] }], now, t)).toBe(
    'Next booking time: Monday at 9:00 AM.',
  );
  // A dated booking time on Wednesday is the next one.
  const once = {
    ...weekly,
    day_of_week: null,
    on_date: '2026-10-07',
    start_time: '13:00',
    end_time: '14:00',
  };
  expect(nowLine('booking-periods', [once], now, t)).toBe(
    'Next booking time: Wednesday at 1:00 PM.',
  );
  // A dated one in a month is not within the week.
  expect(nowLine('booking-periods', [{ ...once, on_date: '2026-11-04' }], now, t)).toBe(
    'No booking times in the next 7 days.',
  );
  // Weekly closed hours that ended last week no longer count.
  const ended = { ...monday, ends_on: '2026-09-28' };
  expect(nowLine('chat-closed-hours', [ended], now, t)).toBe('Messages are open now.');
});
