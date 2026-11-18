/** Forgotten password by email (owner request S5d, 2026-11-18): ask for a link, then use it. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api, ApiError } from '@/api/client';
import ForgotPasswordScreen from '@/app/forgot-password';
import ResetPasswordScreen from '@/app/reset-password';
import { renderWithProviders } from '@/test-utils';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockReplace = jest.fn();
let mockToken: string | undefined = 'a-token-from-the-email-0123456789';
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href), canGoBack: () => false, push: jest.fn() },
  useLocalSearchParams: () => ({ token: mockToken }),
}));
const mockApi = api as jest.MockedFunction<typeof api>;

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue(undefined);
  mockReplace.mockReset();
  mockToken = 'a-token-from-the-email-0123456789';
});

it('asks for a link and says the same thing whether or not the account exists', async () => {
  await renderWithProviders(<ForgotPasswordScreen />, 'en');
  await fireEvent.changeText(screen.getByLabelText('University email'), 'not an email');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a link' }));
  expect(await screen.findByText('Enter a valid email in lowercase letters.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('University email'), ' 4519001@UPM.edu.sa ');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a link' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/auth/forgot-password', 'POST', {
      email: '4519001@upm.edu.sa',
    }),
  );
  expect(await screen.findByText(/^If an account uses 4519001@upm\.edu\.sa, a link/)).toBeTruthy();
});

it('sets a new password typed twice from the link', async () => {
  await renderWithProviders(<ResetPasswordScreen />, 'en');
  await fireEvent.changeText(
    screen.getByLabelText('Password (at least 8 characters)'),
    'New-pass-2026',
  );
  await fireEvent.changeText(screen.getByLabelText('Confirm the password'), 'New-pass-2025');
  await fireEvent.press(screen.getByRole('button', { name: 'Save the new password' }));
  expect(await screen.findByText('The two passwords are not the same.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Confirm the password'), 'New-pass-2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Save the new password' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/auth/reset-password', 'POST', {
      token: 'a-token-from-the-email-0123456789',
      new_password: 'New-pass-2026',
    }),
  );
  expect(await screen.findByText('Password changed')).toBeTruthy();
});

it('explains a link that no longer works and offers a new one', async () => {
  mockApi.mockRejectedValue(new ApiError(400, 'RESET_LINK_INVALID', 'raw'));
  await renderWithProviders(<ResetPasswordScreen />, 'en');
  await fireEvent.changeText(
    screen.getByLabelText('Password (at least 8 characters)'),
    'New-pass-2026',
  );
  await fireEvent.changeText(screen.getByLabelText('Confirm the password'), 'New-pass-2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Save the new password' }));
  expect(await screen.findByText('This link no longer works')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a new link' }));
  expect(mockReplace).toHaveBeenCalledWith('/forgot-password');
});

it('says so at once when the address has no token', async () => {
  mockToken = undefined;
  await renderWithProviders(<ResetPasswordScreen />, 'en');
  expect(screen.getByText('This link no longer works')).toBeTruthy();
});
