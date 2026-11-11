/**
 * Today's timeline as an agenda: finished, current and later blocks, the time between them
 * ("Not in office"), and where "now" falls; each row is read out as one sentence.
 */
import { screen } from '@testing-library/react-native';

import type { Block } from '@/api/types';
import { renderWithProviders } from '@/test-utils';
import { TodayTimeline } from './TodayTimeline';

const blocks: Block[] = [
  {
    block_id: 3,
    kind: 'class',
    day_of_week: 1,
    start_time: '13:00',
    end_time: '14:30',
    label: 'SE 340',
  },
  {
    block_id: 1,
    kind: 'class',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:30',
    label: 'SE 211',
  },
  {
    block_id: 2,
    kind: 'office_hours',
    day_of_week: 1,
    start_time: '10:00',
    end_time: '12:00',
    label: null,
  },
];

it('marks finished, current and later blocks in order, with the gaps between them', async () => {
  await renderWithProviders(<TodayTimeline blocks={blocks} now="10:30" />);
  expect(screen.getByLabelText('8:00 AM–9:30 AM, Class (SE 211), Finished')).toBeTruthy();
  expect(
    screen.getByLabelText('10:00 AM–12:00 PM, Office hours, Now, until 12:00 PM'),
  ).toBeTruthy();
  expect(screen.getByLabelText('1:00 PM–2:30 PM, Class (SE 340)')).toBeTruthy();
  expect(screen.getByText('Not in office, 12:00 PM–1:00 PM')).toBeTruthy();
  expect(screen.getByText('Now, until 12:00 PM')).toBeTruthy();
});

it('shows "now" inside a gap, and after the last block', async () => {
  await renderWithProviders(<TodayTimeline blocks={blocks} now="12:15" />);
  expect(screen.getByLabelText('12:00 PM–1:00 PM, Not in office, Now 12:15 PM')).toBeTruthy();
  await renderWithProviders(<TodayTimeline blocks={blocks} now="15:00" />);
  expect(screen.getByText('Now 3:00 PM')).toBeTruthy();
});

it('reads in Arabic', async () => {
  await renderWithProviders(<TodayTimeline blocks={blocks} now="10:30" />, 'ar');
  expect(screen.getByText('الآن، حتى 12:00 م')).toBeTruthy();
  expect(screen.getByText('خارج المكتب، 12:00 م–1:00 م')).toBeTruthy();
});
