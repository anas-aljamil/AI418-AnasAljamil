/** Notifications (DESIGN.md 7.9): grouped by day, each opens its source; settings filter them. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { api } from '@/api/client';
import type { AppNotification, Me } from '@/api/types';
import NotificationsScreen from '@/app/notifications';
import { renderWithProviders } from '@/test-utils';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  },
}));
const mockUser = { user_id: 9, role: 'student' } as Me;
jest.mock('@/auth/AuthProvider', () => ({
  useUser: () => mockUser,
  useAuth: () => ({ state: { status: 'signedIn', user: mockUser } }),
}));
const mockApi = api as jest.MockedFunction<typeof api>;

const professor = {
  user_id: 1,
  full_name_ar: 'نورة الحربي',
  full_name_en: 'Noura Al-Harbi',
  role: 'professor' as const,
  honorific: 'dr' as const,
};
const items: AppNotification[] = [
  {
    notification_id: 11,
    type: 'new_message',
    created_at: new Date().toISOString(),
    read_at: null,
    appointment_id: null,
    conversation_id: 1,
    actor: professor,
    starts_at: null,
  },
  {
    notification_id: 2,
    type: 'appointment_approved',
    created_at: '2026-09-30T13:20:00Z',
    read_at: '2026-09-30T13:45:00Z',
    appointment_id: 6,
    conversation_id: null,
    actor: professor,
    starts_at: '2026-10-04T07:00:00Z',
  },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path.startsWith('/notifications?')) return { items, total: 2, limit: 50, offset: 0 };
    if (path === '/notifications/read') return undefined;
    throw new Error(`unexpected ${path}`);
  });
});

it('groups by today and earlier and opens the source, marking it read', async () => {
  await renderWithProviders(<NotificationsScreen />);
  expect(await screen.findByText('New message from Dr. Noura Al-Harbi')).toBeTruthy();
  expect(screen.getByText('Today')).toBeTruthy();
  expect(screen.getByText('Earlier')).toBeTruthy();
  expect(screen.getByText(/^Dr\. Noura Al-Harbi approved your appointment, /)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^New, New message from/ }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/notifications/read', 'POST', { ids: [11] }),
  );
  expect(router.push).toHaveBeenCalledWith('/conversations/1');
});

it('hides what the settings turn off and says so', async () => {
  await AsyncStorage.setItem('mawjood.notifications', JSON.stringify({ messages: false }));
  await renderWithProviders(<NotificationsScreen />);
  expect(await screen.findByText('Some notifications are hidden by your settings.')).toBeTruthy();
  expect(screen.queryByText('New message from Dr. Noura Al-Harbi')).toBeNull();
});
