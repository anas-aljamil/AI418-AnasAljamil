/**
 * Approved appointments (owner request S5c, 2026-11-18): the professor cancels with a reason or
 * suggests another time; the ticket shows both; the student accepts or keeps their time.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
import type { Appointment } from '@/api/types';
import { renderWithProviders } from '@/test-utils';
import { AppointmentCard } from './AppointmentCard';
import { ProposalAnswer } from './ProposalAnswer';
import { RequestActions } from './RequestActions';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockApi = api as jest.MockedFunction<typeof api>;

const now = new Date('2026-10-05T07:00:00Z'); // Monday 10:00 Riyadh
const approved: Appointment = {
  appointment_id: 6,
  status: 'approved',
  starts_at: '2026-10-11T07:30:00Z', // Sunday 10:30 Riyadh
  ends_at: '2026-10-11T07:45:00Z',
  cancel_deadline: '2026-10-11T06:30:00Z',
  topic: null,
  note: null,
  decline_reason: null,
  cancel_reason: null,
  proposed_starts_at: null,
  proposed_ends_at: null,
  student: { user_id: 9, full_name_ar: 'سعد المطيري', full_name_en: 'Saad Al-Mutairi' },
  professor: {
    user_id: 1,
    full_name_ar: 'نورة الحربي',
    full_name_en: 'Noura Al-Harbi',
    honorific: 'dr',
    office: null,
  },
};
const suggested: Appointment = {
  ...approved,
  proposed_starts_at: '2026-10-11T08:00:00Z',
  proposed_ends_at: '2026-10-11T08:15:00Z',
};

const slot = (starts_at: string, local_time: string, max_minutes: number) => ({
  starts_at,
  local_time,
  available: true,
  reason: null,
  max_minutes,
});

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue(approved);
});

it('lets the professor cancel with a reason the student will see', async () => {
  await renderWithProviders(<RequestActions appointment={approved} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Cancel: Saad Al-Mutairi/ }));
  expect(await screen.findByText('Cancel the appointment with Saad Al-Mutairi?')).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText('Reason (optional)'),
    ' Called to a committee. ',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel appointment' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/appointments/6/cancel', 'POST', {
      reason: 'Called to a committee.',
    }),
  );
});

it('offers another time for a request that has not started, and not after it starts', async () => {
  await renderWithProviders(<RequestActions appointment={approved} now={now} />);
  expect(
    screen.getByRole('button', { name: /^Suggest another time: Saad Al-Mutairi/ }),
  ).toBeTruthy();
  await renderWithProviders(
    <RequestActions appointment={approved} now={new Date('2026-10-11T07:35:00Z')} />,
  );
  expect(screen.queryByRole('button', { name: /^Suggest another time/ })).toBeNull();
});

it('suggests a time from the wheels with the same length', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/professors/1') return { booking_days: ['2026-10-11'] };
    if (path.startsWith('/professors/1/slots')) {
      expect(path).toContain('exclude=6'); // its own time counts as free
      return {
        professor_id: 1,
        date: '2026-10-11',
        default_minutes: 15,
        step_minutes: 5,
        slots: [
          slot('2026-10-11T07:30:00Z', '10:30', 30), // the appointment's own start
          slot('2026-10-11T07:40:00Z', '10:40', 10), // free, but 10 minutes before the next one
          slot('2026-10-11T07:50:00Z', '10:50', 60),
        ],
      };
    }
    return suggested;
  });
  await renderWithProviders(<RequestActions appointment={approved} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Suggest another time/ }));
  // Its own start is not a choice, and 10:40 is too short for its 15 minutes.
  expect(await screen.findByRole('radio', { name: '10:30 AM, booked' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: '10:40 AM, too short' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: '10:50 AM' })).toBeChecked();
  expect(screen.getByText('10:50 AM to 11:05 AM')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest 10:50 AM' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/appointments/6/propose', 'POST', {
      starts_at: '2026-10-11T07:50:00Z',
    }),
  );
});

it('shows the suggestion and the reason on the ticket', async () => {
  await renderWithProviders(
    <AppointmentCard appointment={suggested} now={now} perspective="student" />,
  );
  expect(screen.getByText('Dr. Noura Al-Harbi suggests another time')).toBeTruthy();
  expect(screen.getByText(/^Sunday 11:00 AM, until 11:15 AM$/)).toBeTruthy();
  await renderWithProviders(
    <AppointmentCard
      appointment={{ ...approved, status: 'cancelled', cancel_reason: 'Called to a committee.' }}
      now={now}
      perspective="student"
    />,
  );
  expect(screen.getByText('Reason given')).toBeTruthy();
  expect(screen.getByText('Called to a committee.')).toBeTruthy();
});

it('lets the student accept the suggested time or keep their own', async () => {
  await renderWithProviders(<ProposalAnswer appointment={suggested} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Accept Sunday 11:00 AM/ }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/appointments/6/proposal/accept', 'POST'),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Keep my time' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/appointments/6/proposal/decline', 'POST'),
  );
});
