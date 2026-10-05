/**
 * Conversation thread (DESIGN.md 7.7): read receipts, marking read, a message that shows at
 * once and can be retried when it fails, and professors' quick replies.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api, ApiError } from '@/api/client';
import type { ChatMessage, Conversation, Me } from '@/api/types';
import ConversationScreen from '@/app/conversations/[id]';
import { renderWithProviders } from '@/test-utils';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: '1' }),
}));
let mockUser = { user_id: 9, role: 'student' } as Me;
jest.mock('@/auth/AuthProvider', () => ({ useUser: () => mockUser }));
const mockApi = api as jest.MockedFunction<typeof api>;

const conversation: Conversation = {
  conversation_id: 1,
  other: {
    user_id: 1,
    full_name_ar: 'نورة الحربي',
    full_name_en: 'Noura Al-Harbi',
    role: 'professor',
    honorific: 'dr',
  },
  last_message: null,
  unread_count: 1,
  created_at: '2026-09-30T17:00:00Z',
};
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const message = (id: number, mine: boolean, body: string, read = false): ChatMessage => ({
  message_id: id,
  sender_role: mine ? 'student' : 'professor',
  mine,
  body,
  created_at: minutesAgo(30 - id),
  read_at: read ? minutesAgo(1) : null,
});

function serve(onSend: (body: string) => unknown) {
  mockApi.mockImplementation(async (path: string, method = 'GET', body?: unknown) => {
    if (path.startsWith('/conversations?')) {
      return { items: [conversation], total: 1, limit: 100, offset: 0 };
    }
    if (path.startsWith('/conversations/1/messages') && method === 'GET') {
      const items = [
        message(2, false, 'Yes, bring it printed.'),
        message(1, true, 'Shall I bring the draft?', true),
      ];
      return { items, total: 2, limit: 100, offset: 0 };
    }
    if (path === '/conversations/1/read') return undefined;
    if (path === '/conversations/1/messages') return onSend((body as { body: string }).body);
    throw new Error(`unexpected ${method} ${path}`);
  });
}

beforeEach(() => {
  mockApi.mockReset();
  mockUser = { user_id: 9, role: 'student' } as Me;
});

it('shows the thread, the read receipt, and marks the other side read', async () => {
  serve(() => undefined);
  await renderWithProviders(<ConversationScreen />);
  expect(await screen.findByText('Yes, bring it printed.')).toBeTruthy();
  expect(screen.getByText('Dr. Noura Al-Harbi')).toBeTruthy();
  expect(screen.getByText(/Read$/)).toBeTruthy();
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/conversations/1/read', 'POST'));
});

it('shows a message at once and lets a failed one be sent again', async () => {
  let fail = true;
  serve((body) => {
    if (fail) throw new ApiError(0, 'NETWORK', 'down');
    return { ...message(3, true, body), created_at: new Date().toISOString() };
  });
  await renderWithProviders(<ConversationScreen />);
  await screen.findByText('Yes, bring it printed.');
  await fireEvent.changeText(screen.getByLabelText('Message to Dr. Noura Al-Harbi'), 'On my way');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText(/Not sent\. Tap to try again\.$/)).toBeTruthy();
  expect(screen.getByText('On my way')).toBeTruthy(); // kept, not lost

  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'On my way' }));
  await waitFor(() => expect(screen.queryByText(/Not sent/)).toBeNull());
  expect(mockApi).toHaveBeenCalledWith('/conversations/1/messages', 'POST', { body: 'On my way' });
});

it('gives professors quick replies that send in one tap', async () => {
  mockUser = { user_id: 1, role: 'professor' } as Me;
  serve((body) => ({ ...message(3, true, body), created_at: new Date().toISOString() }));
  await renderWithProviders(<ConversationScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Come now' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/conversations/1/messages', 'POST', { body: 'Come now' }),
  );
});
