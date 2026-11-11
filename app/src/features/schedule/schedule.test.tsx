/**
 * Booking times and closed message hours (owner decisions 2026-11-07): how a range reads
 * (overnight, until midnight, all day), and the sheets that add one: several days at once, a
 * start and a length (2026-11-11).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, api } from '@/api/client';
import { renderWithProviders } from '@/test-utils';
import i18n from '@/i18n';
import { rangeLine, WeeklyRanges } from './WeeklyRanges';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 100, offset: 0 });

beforeEach(() => mockApi.mockReset());

it('says how each kind of closed range reads', async () => {
  await renderWithProviders(<></>);
  const t = i18n.t.bind(i18n);
  const line = (start_time: string, end_time: string) =>
    rangeLine({ day_of_week: 4, start_time, end_time }, t);
  expect(line('10:00', '12:00')).toBe('10:00 AM–12:00 PM');
  expect(line('20:00', '08:00')).toBe('8:00 PM to 8:00 AM the next day');
  expect(line('16:00', '00:00')).toBe('4:00 PM until midnight');
  expect(line('00:00', '00:00')).toBe('All day');
});

it('lists booking times by day and warns when there are none', async () => {
  mockApi.mockResolvedValue(page([]));
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  expect(await screen.findByText(/Students cannot book you until you add one/)).toBeTruthy();
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
  await fireEvent.press(screen.getByLabelText('Start, 9 AM'));
  await fireEvent.press(screen.getByLabelText('Length, 2 hours'));
  expect(screen.getByText('Sunday to Thursday, 9:00 AM–11:00 AM')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save booking time'));
  await waitFor(() => expect(posts('/me/booking-periods')).toHaveLength(5));
  expect(posts('/me/booking-periods').map(([, , body]) => body)).toEqual(
    [0, 1, 2, 3, 4].map((day) => ({ day_of_week: day, start_time: '09:00', end_time: '11:00' })),
  );
});

it('keeps the start and moves the end when the length changes, never past the day', async () => {
  mockApi.mockResolvedValue(page([]));
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  // The default is 10:00 AM for an hour; 15 minutes longer ends at 11:15 AM.
  await fireEvent.press(await screen.findByLabelText('15 minutes longer'));
  expect(screen.getByText('1 hour 15 minutes, until 11:15 AM')).toBeTruthy();
  // A start at 9 PM keeps the length; nothing longer than 2 hours 45 minutes fits the day.
  await fireEvent.press(screen.getByLabelText('Start, 9 PM'));
  expect(screen.getByText('1 hour 15 minutes, until 10:15 PM')).toBeTruthy();
  expect(screen.queryByLabelText('Length, 3 hours')).toBeNull();
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
      return { closure_id: 9, day_of_week: 0, start_time: '20:00', end_time: '08:00' };
    return page([{ closure_id: 1, day_of_week: 6, start_time: '00:00', end_time: '00:00' }]);
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
  await fireEvent.press(await screen.findByLabelText('Start, 12 AM'));
  await fireEvent.press(screen.getByLabelText('Length, All day'));
  expect(screen.getByText('Sunday, All day')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save closed hours'));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/chat-closed-hours', 'POST', {
      day_of_week: 0,
      start_time: '00:00',
      end_time: '00:00',
    }),
  );
});
