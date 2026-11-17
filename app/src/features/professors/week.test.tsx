/**
 * The week on the professor's profile (2026-11-17): every day on one scale, the hour labels
 * once over the first day, and each day's times written out under its bar.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import type { Block } from '@/api/types';
import { renderWithProviders } from '@/test-utils';
import { WeekRibbons } from './WeekRibbons';

const block = (block_id: number, kind: Block['kind'], start: string, end: string): Block => ({
  block_id,
  kind,
  start_time: start,
  end_time: end,
  label: null,
  day_of_week: 0,
  on_date: null,
  ends_on: null,
  skipped_dates: [],
});

const WEEK = [
  {
    date: '2026-10-04',
    day_of_week: 0,
    blocks: [block(2, 'office_hours', '13:00', '15:00'), block(1, 'class', '10:00', '11:30')],
  },
  { date: '2026-10-05', day_of_week: 1, blocks: [] },
];

it('writes each day’s times under its bar, in time order, and names a free day', async () => {
  await renderWithProviders(<WeekRibbons week={WEEK} today="2026-10-05" now="10:00" />);
  const hidden = { includeHiddenElements: true };
  expect(screen.getByText('10:00–11:30 AM', hidden)).toBeTruthy();
  expect(screen.getByText('1:00–3:00 PM', hidden)).toBeTruthy();
  expect(screen.getByText('Nothing on the timetable', hidden)).toBeTruthy();
  // Screen readers get each day as one sentence instead.
  expect(
    screen.getByRole('image', {
      name: 'Sunday, 10:00 AM–11:30 AM, Class, 1:00 PM–3:00 PM, Office hours',
    }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('image', { name: 'Monday: no office hours or classes, Now 10:00 AM' }),
  ).toBeOnTheScreen();
});

it('shows the hour labels once for the whole week', async () => {
  await renderWithProviders(<WeekRibbons week={WEEK} today="2026-10-05" now="10:00" />);
  const axes = screen.getAllByTestId('ribbon-axis', { includeHiddenElements: true });
  expect(axes).toHaveLength(1);
  await fireEvent(screen.getByTestId('ribbon-axis', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { width: 540, height: 20 } },
  });
  expect(screen.getByText('8 AM', { includeHiddenElements: true })).toBeTruthy();
});
