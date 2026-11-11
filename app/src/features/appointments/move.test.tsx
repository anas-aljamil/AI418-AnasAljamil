/**
 * Moving earlier (CLAUDE.md Section 4): the sheet offers the earlier free starts the same day,
 * the earliest first as the one-tap choice, and says so when none is left.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import { api, ApiError } from '@/api/client';
import type { Appointment } from '@/api/types';
import { renderWithProviders } from '@/test-utils';
import { MoveSheet } from './MoveSheet';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

// Sunday 2026-10-11, 10:30-10:45 Riyadh.
const appointment = {
  appointment_id: 6,
  status: 'approved',
  starts_at: '2026-10-11T07:30:00Z',
  ends_at: '2026-10-11T07:45:00Z',
  cancel_deadline: '2026-10-11T06:30:00Z',
  topic: null,
  note: null,
  student: { user_id: 9, full_name_ar: 'سعد', full_name_en: 'Saad' },
  professor: {
    user_id: 1,
    full_name_ar: 'نورة الحربي',
    full_name_en: 'Noura Al-Harbi',
    honorific: 'dr',
    office: null,
  },
} as Appointment;

beforeEach(() => mockApi.mockReset());

it('moves to the earliest free time in one tap, or to another one chosen', async () => {
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    if (path === '/appointments/6/earlier-starts') {
      return { appointment_id: 6, starts: ['2026-10-11T07:00:00Z', '2026-10-11T07:05:00Z'] };
    }
    if (path === '/appointments/6/move' && method === 'POST') return appointment;
    throw new Error(`unexpected ${method} ${path}`);
  });
  await renderWithProviders(<MoveSheet appointment={appointment} onClose={() => undefined} />);
  expect(await screen.findByRole('button', { name: 'Move to 10:00 AM' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '10:05 AM' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to 10:05 AM' }));
  expect(mockApi).toHaveBeenCalledWith('/appointments/6/move', 'POST', {
    starts_at: '2026-10-11T07:05:00Z',
  });
  expect(await screen.findByText('Moved to 10:05 AM')).toBeTruthy();
});

it('says when no earlier time is free, and shows why a move failed', async () => {
  let starts = ['2026-10-11T07:00:00Z'];
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    if (path === '/appointments/6/earlier-starts') return { appointment_id: 6, starts };
    if (path === '/appointments/6/move' && method === 'POST') {
      starts = [];
      throw new ApiError(409, 'SLOT_TAKEN', 'raw');
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
  await renderWithProviders(<MoveSheet appointment={appointment} onClose={() => undefined} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Move to 10:00 AM' }));
  expect(
    await screen.findByText('This time was just booked by someone else. Choose another time.'),
  ).toBeTruthy();
  expect(await screen.findByText('No earlier time is free now.')).toBeTruthy();
});
