/** Change password (2026-11-16): the new password is typed twice (owner request 2026-11-18). */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
import { renderWithProviders } from '@/test-utils';
import { PasswordSheet } from './AccountSheets';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ updateUser: jest.fn() }) }));
const mockApi = api as jest.MockedFunction<typeof api>;

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue(undefined);
});

async function fill(again: string) {
  await renderWithProviders(<PasswordSheet visible onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Current password'), 'old-password');
  await fireEvent.changeText(
    screen.getByLabelText('New password (at least 8 characters)'),
    'a-new-password',
  );
  await fireEvent.changeText(screen.getByLabelText('Confirm the new password'), again);
  await fireEvent.press(screen.getByRole('button', { name: 'Save the new password' }));
}

it('says so when the two new passwords differ, and sends nothing', async () => {
  await fill('a-new-pasword');
  expect(await screen.findByText('The two new passwords are not the same.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled();
});

it('sends the new password once when both copies match', async () => {
  await fill('a-new-password');
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/auth/password', 'POST', {
      current_password: 'old-password',
      new_password: 'a-new-password',
    }),
  );
});
