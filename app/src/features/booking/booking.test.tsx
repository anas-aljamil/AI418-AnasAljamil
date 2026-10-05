/**
 * Booking sheet (DESIGN.md 7.5): unavailable times explain themselves, an error never loses
 * the selection (only a time someone else just took is unselected), and success shows the
 * "Booked with ..." moment.
 */
import { screen, waitFor, fireEvent } from '@testing-library/react-native';

import { api, ApiError } from '@/api/client';
import type { ProfessorDetail } from '@/api/types';
import { renderWithProviders, testDepartment } from '@/test-utils';
import { BookingSheet } from './BookingSheet';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

const department = testDepartment(1, 'SE', 'هندسة البرمجيات', 'Software Engineering');
const noura = {
  professor_id: 1,
  full_name_ar: 'نورة الحربي',
  full_name_en: 'Noura Al-Harbi',
  honorific: 'dr',
  academic_rank: 'assistant_professor',
  department,
  office: { office_id: 1, building_code: 'A', floor: 2, room_number: '214' },
  status: {
    status: 'away',
    confirmed: true,
    source: 'schedule',
    note: null,
    until: null,
    updated_at: null,
  },
  has_office_hours_today: true,
  is_pinned: false,
  slot_minutes: 15,
  open_messages: false,
  today: { date: '2026-10-05', day_of_week: 1, now_local_time: '10:00', blocks: [] },
} as ProfessorDetail;

const inTwoDays = Date.now() + 2 * 86_400_000;
const slots = {
  professor_id: 1,
  date: '2026-10-07',
  slot_minutes: 15,
  slots: [
    {
      starts_at: new Date(inTwoDays).toISOString(),
      ends_at: new Date(inTwoDays + 900_000).toISOString(),
      local_time: '10:00',
      available: true,
      reason: null,
    },
    {
      starts_at: new Date(inTwoDays + 900_000).toISOString(),
      ends_at: new Date(inTwoDays + 1_800_000).toISOString(),
      local_time: '10:15',
      available: false,
      reason: 'taken',
    },
  ],
};

function serve(onBook: () => unknown) {
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    if (path.startsWith('/professors/1/slots')) return slots;
    if (path === '/appointments' && method === 'POST') return onBook();
    throw new Error(`unexpected ${method} ${path}`);
  });
}

async function chooseTimeAndTopic() {
  await renderWithProviders(<BookingSheet professor={noura} visible onClose={() => undefined} />);
  await fireEvent.press(await screen.findByRole('button', { name: '10:15 AM, unavailable' }));
  expect(screen.getByText('This time is already booked. Choose another.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '10:00 AM' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Advising' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Book 10:00 AM' }));
}

beforeEach(() => mockApi.mockReset());

it('keeps the time, topic and note when the API refuses the booking', async () => {
  serve(() => {
    throw new ApiError(409, 'BOOKING_LIMIT', 'raw');
  });
  await chooseTimeAndTopic();
  expect(
    await screen.findByText(
      'You already have 2 upcoming appointments with this professor. Cancel one to book another.',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Book 10:00 AM' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Advising' })).toBeSelected();
});

it('unselects only a time that someone else just took, and reloads the times', async () => {
  serve(() => {
    throw new ApiError(409, 'SLOT_TAKEN', 'raw');
  });
  await chooseTimeAndTopic();
  expect(
    await screen.findByText('This time was just booked by someone else. Choose another time.'),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Choose a time' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Advising' })).toBeSelected();
  await waitFor(() =>
    expect(
      mockApi.mock.calls.filter(([path]) => String(path).includes('/slots')).length,
    ).toBeGreaterThan(1),
  );
});

it('shows the booked moment with the professor and the time', async () => {
  serve(() => ({ ...slots.slots[0], appointment_id: 7, status: 'pending' }));
  await chooseTimeAndTopic();
  expect(await screen.findByText(/^Booked with Dr\. Noura Al-Harbi, /)).toBeTruthy();
  expect(mockApi).toHaveBeenCalledWith('/appointments', 'POST', {
    professor_id: 1,
    starts_at: slots.slots[0]!.starts_at,
    topic: 'advising',
    note: null,
  });
});
