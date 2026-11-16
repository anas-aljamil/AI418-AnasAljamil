/**
 * Help and contact's form (2026-11-16), and the professor's optional reason when declining.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
import type { Appointment } from '@/api/types';
import { RequestActions } from '@/features/appointments/RequestActions';
import { renderWithProviders } from '@/test-utils';
import { ContactForm } from './ContactForm';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'signedOut', user: null } }),
}));
const mockApi = api as jest.MockedFunction<typeof api>;

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({});
});

it('sends a message without an account and says where the answer goes', async () => {
  await renderWithProviders(<ContactForm />);
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Write your name.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Your name'), 'Rakan Al-Juhani');
  await fireEvent.changeText(screen.getByLabelText('Your email'), ' R.AlJuhani@University.Example');
  await fireEvent.press(screen.getByRole('button', { name: 'Something does not work' }));
  await fireEvent.changeText(screen.getByLabelText('Message'), 'The calendar does not open.');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/contact', 'POST', {
      name: 'Rakan Al-Juhani',
      email: 'R.AlJuhani@University.Example',
      topic: 'problem',
      body: 'The calendar does not open.',
    }),
  );
  expect(
    await screen.findByText('The administrator will answer at r.aljuhani@university.example.'),
  ).toBeTruthy();
});

it('asks before declining and sends the optional reason', async () => {
  const pending: Appointment = {
    appointment_id: 7,
    status: 'pending',
    starts_at: '2026-10-13T07:00:00Z',
    ends_at: '2026-10-13T07:15:00Z',
    cancel_deadline: '2026-10-13T06:00:00Z',
    topic: null,
    note: null,
    decline_reason: null,
    student: { user_id: 9, full_name_ar: 'سعد المطيري', full_name_en: 'Saad Al-Mutairi' },
    professor: {
      user_id: 1,
      full_name_ar: 'نورة الحربي',
      full_name_en: 'Noura Al-Harbi',
      honorific: 'dr',
      office: null,
    },
  };
  await renderWithProviders(
    <RequestActions appointment={pending} now={new Date('2026-10-05T07:00:00Z')} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: /^Decline: Saad Al-Mutairi/ }));
  expect(mockApi).not.toHaveBeenCalled();
  expect(await screen.findByText('Decline the request from Saad Al-Mutairi?')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Reason (optional)'), ' On leave that week. ');
  await fireEvent.press(screen.getByRole('button', { name: 'Decline' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/appointments/7/decline', 'POST', {
      reason: 'On leave that week.',
    }),
  );
});
