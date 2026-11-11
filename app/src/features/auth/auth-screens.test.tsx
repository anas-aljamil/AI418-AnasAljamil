/** Sign-in, the screen the app opens on, with its language switch (DESIGN.md 7.1). */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import SignInScreen from '@/app/sign-in';
import { switchLanguage } from '@/i18n';
import { renderWithProviders } from '@/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
  Redirect: () => null,
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ar' }] }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  ...jest.requireActual('@/i18n'),
  switchLanguage: jest.fn(async () => undefined),
}));
const mockSignIn = jest.fn();
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'signedOut', user: null }, signIn: mockSignIn }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockSignIn.mockReset();
  (switchLanguage as jest.Mock).mockClear();
});

describe('language switch on sign-in', () => {
  it('sits at the top, before the title, and names the other language', async () => {
    await renderWithProviders(<SignInScreen />, 'en');
    const button = screen.getByRole('button', { name: 'Change the language to العربية' });
    expect(button).toHaveTextContent('العربية');
    const order = screen
      .getAllByRole(/button|header/)
      .map((el) => el.props.accessibilityLabel ?? '');
    expect(order.indexOf('Change the language to العربية')).toBe(0);
  });

  it('switches to Arabic in one tap', async () => {
    await renderWithProviders(<SignInScreen />, 'en');
    await fireEvent.press(screen.getByRole('button', { name: 'Change the language to العربية' }));
    expect(switchLanguage).toHaveBeenCalledWith('ar');
  });

  it('in Arabic, offers English', async () => {
    await renderWithProviders(<SignInScreen />, 'ar');
    await fireEvent.press(screen.getByRole('button', { name: 'غيّر اللغة إلى English' }));
    expect(switchLanguage).toHaveBeenCalledWith('en');
  });
});

describe('sign-in screen', () => {
  it('labels both fields and asks for what is missing', async () => {
    await renderWithProviders(<SignInScreen />, 'en');
    expect(screen.getByLabelText('University email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email and password.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_CREDENTIALS', 401, 'The email or password is incorrect.'],
    ['RATE_LIMITED', 429, 'Too many attempts. Wait a minute, then try again.'],
    ['NETWORK', 0, "Can't reach the Mawjood server. Check your connection, then try again."],
    ['SOMETHING_ELSE', 500, 'Something went wrong on the server. Try again in a moment.'],
  ])('explains %s', async (code, status, message) => {
    mockSignIn.mockRejectedValueOnce(new ApiError(status, code, 'raw server text'));
    await renderWithProviders(<SignInScreen />, 'en');
    await fireEvent.changeText(
      screen.getByLabelText('University email'),
      's.almutairi@university.example',
    );
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('signs in and lets the start route pick the home for the role', async () => {
    mockSignIn.mockResolvedValueOnce({ role: 'student' });
    await renderWithProviders(<SignInScreen />, 'ar');
    await fireEvent.changeText(
      screen.getByLabelText('البريد الجامعي'),
      's.almutairi@university.example',
    );
    await fireEvent.changeText(screen.getByLabelText('كلمة المرور'), 'Mawjood-Demo-2026');
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockSignIn).toHaveBeenCalledWith('s.almutairi@university.example', 'Mawjood-Demo-2026');
  });
});
