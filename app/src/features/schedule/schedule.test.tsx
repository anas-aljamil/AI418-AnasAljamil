/**
 * Booking times and closed message hours (owner decisions 2026-11-07): how a range reads
 * (overnight, until midnight, all day), and the sheets that add one.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
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

it('refuses a booking time that ends before it starts, before sending', async () => {
  mockApi.mockResolvedValue(page([]));
  await renderWithProviders(<WeeklyRanges kind="booking-periods" />);
  await fireEvent.press(await screen.findByText('Add booking time'));
  // Start 10:00 AM by default; make the start 11 so it is after the 11:00 AM end.
  await fireEvent.press(await screen.findByLabelText('Start, hour 11'));
  await fireEvent.press(screen.getByText('Save booking time'));
  expect(await screen.findByText('The end must be after the start.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalledWith('/me/booking-periods', 'POST', expect.anything());
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
  await fireEvent.press(screen.getByText('Save closed hours'));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/chat-closed-hours', 'POST', {
      day_of_week: 0,
      start_time: '20:00',
      end_time: '08:00',
    }),
  );
});
