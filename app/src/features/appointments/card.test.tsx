/**
 * The appointment ticket (DESIGN.md Section 11): the time at the start edge with its day
 * ("Today", "Tomorrow", the weekday, or the date further out), then who, and the actions.
 */
import { screen } from '@testing-library/react-native';

import type { Appointment } from '@/api/types';
import { Text } from '@/components/Text';
import { renderWithProviders } from '@/test-utils';
import { AppointmentCard } from './AppointmentCard';

// Monday 10:00 in Riyadh.
const NOW = new Date('2026-10-05T07:00:00Z');

function appointment(startsAt: string): Appointment {
  const start = new Date(startsAt);
  return {
    appointment_id: 1,
    status: 'pending',
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 15 * 60_000).toISOString(),
    cancel_deadline: new Date(start.getTime() - 60 * 60_000).toISOString(),
    topic: null,
    note: null,
    decline_reason: null,
    student: { user_id: 9, full_name_ar: 'سعد المطيري', full_name_en: 'Saad Al-Mutairi' },
    professor: {
      user_id: 1,
      full_name_ar: 'نورة الحربي',
      full_name_en: 'Noura Al-Harbi',
      honorific: 'dr',
      office: { office_id: 1, building_code: 'A', floor: 2, room_number: '214' },
    },
  };
}

it.each([
  ['2026-10-05T08:00:00Z', '11:00 AM', 'Today'],
  ['2026-10-06T07:00:00Z', '10:00 AM', 'Tomorrow'],
  ['2026-10-08T07:30:00Z', '10:30 AM', 'Thursday'],
  ['2026-11-02T07:00:00Z', '10:00 AM', '2 November'],
  ['2026-10-01T07:00:00Z', '10:00 AM', '1 October'],
])('shows the time and the day of %s', async (startsAt, time, day) => {
  await renderWithProviders(
    <AppointmentCard appointment={appointment(startsAt)} now={NOW} perspective="professor" />,
  );
  expect(screen.getByText(time)).toBeTruthy();
  expect(screen.getByText(day)).toBeTruthy();
});

it('names the other person for each side and keeps the actions', async () => {
  await renderWithProviders(
    <AppointmentCard
      appointment={appointment('2026-10-06T07:00:00Z')}
      now={NOW}
      perspective="student"
    >
      <Text>Cancel here</Text>
    </AppointmentCard>,
  );
  expect(screen.getByText('Dr. Noura Al-Harbi')).toBeTruthy();
  expect(screen.queryByText('Saad Al-Mutairi')).toBeNull();
  expect(screen.getByText('Until 10:15 AM, 15 min')).toBeTruthy();
  expect(screen.getByText('Waiting for approval')).toBeTruthy();
  expect(screen.getByText('Cancel here')).toBeTruthy();
});
