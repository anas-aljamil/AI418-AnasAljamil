/** Create an account: checks before sending, student signed in, professor waits for an admin. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import SignUpScreen from '@/app/sign-up';
import { renderWithProviders } from '@/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href), canGoBack: () => false },
  Redirect: () => null,
}));
const mockSignUp = jest.fn();
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'signedOut', user: null }, signUp: mockSignUp }),
}));
jest.mock('@/api/queries', () => ({
  useDepartments: () => ({
    data: [
      { department_id: 1, code: 'CS', name_ar: 'علوم الحاسب', name_en: 'Computer Science' },
      { department_id: 2, code: 'IS', name_ar: 'نظم المعلومات', name_en: 'Information Systems' },
    ],
  }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockSignUp.mockReset();
});

async function fillAccount() {
  await fireEvent.changeText(screen.getByLabelText('Name in Arabic'), 'رنا القحطاني');
  await fireEvent.changeText(screen.getByLabelText('Name in English'), 'Rana Al-Qahtani');
  await fireEvent.changeText(
    screen.getByLabelText('University email'),
    ' R.AlQahtani@University.Example ',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password (at least 8 characters)'),
    'a-long-password',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Information Systems' }));
}

it('says what is missing next to each field before sending anything', async () => {
  await renderWithProviders(<SignUpScreen />, 'en');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Check the fields marked above.')).toBeTruthy();
  expect(screen.getAllByText('Use at least 2 characters.')).toHaveLength(2);
  expect(screen.getByText('Enter a valid email in lowercase letters.')).toBeTruthy();
  expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
  expect(screen.getByText('Choose one.')).toBeTruthy();
  expect(screen.getByText('Use 4 to 12 capital letters or digits.')).toBeTruthy();
  expect(mockSignUp).not.toHaveBeenCalled();
});

it('creates a student account and goes straight in', async () => {
  mockSignUp.mockResolvedValueOnce('signedIn');
  await renderWithProviders(<SignUpScreen />, 'en');
  await fillAccount();
  await fireEvent.changeText(screen.getByLabelText('University number'), 's2001');
  await fireEvent.press(screen.getByRole('button', { name: 'Year 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockSignUp).toHaveBeenCalledWith({
    role: 'student',
    email: 'r.alqahtani@university.example',
    password: 'a-long-password',
    full_name_ar: 'رنا القحطاني',
    full_name_en: 'Rana Al-Qahtani',
    preferred_locale: 'en',
    department_id: 2,
    university_no: 'S2001',
    study_year: 2,
  });
});

it('sends a professor request and says an administrator will activate it', async () => {
  mockSignUp.mockResolvedValueOnce('pending');
  await renderWithProviders(<SignUpScreen />, 'en');
  await fireEvent.press(screen.getByRole('tab', { name: 'Professor' }));
  expect(screen.queryByLabelText('University number')).toBeNull();
  await fillAccount();
  await fireEvent.press(screen.getByRole('button', { name: 'Prof.' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  expect(await screen.findByText('Request sent')).toBeTruthy();
  expect(screen.getByText(/Then sign in with r\.alqahtani@university\.example\.$/)).toBeTruthy();
  expect(mockSignUp).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'professor',
      honorific: 'prof',
      academic_rank: 'assistant_professor',
    }),
  );
  expect(mockReplace).not.toHaveBeenCalled();
});

it('shows a taken email at the email field', async () => {
  mockSignUp.mockRejectedValueOnce(new ApiError(409, 'EMAIL_TAKEN', 'raw'));
  await renderWithProviders(<SignUpScreen />, 'en');
  await fillAccount();
  await fireEvent.changeText(screen.getByLabelText('University number'), 'S2001');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  const message =
    'An account with this email already exists. Sign in instead, or use another email.';
  await waitFor(() => expect(screen.getAllByText(message)).toHaveLength(2)); // field + summary
});
