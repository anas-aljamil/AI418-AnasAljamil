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
// jest.mock factories may only use variables whose names start with "mock".
const mockDepartment = (id: number, code: string, ar: string, en: string) =>
  jest.requireActual('@/test-utils').testDepartment(id, code, ar, en);
jest.mock('@/api/queries', () => ({
  useDepartments: () => ({
    data: [
      mockDepartment(1, 'SE', 'هندسة البرمجيات', 'Software Engineering'),
      mockDepartment(
        2,
        'CYB',
        'الأمن السيبراني والحوسبة الجنائية',
        'Cybersecurity and Forensic Computing',
      ),
    ],
  }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockSignUp.mockReset();
});

async function fillAccount(email = ' 4519001@UPM.edu.sa ') {
  await fireEvent.changeText(screen.getByLabelText('Name in Arabic'), 'رنا القحطاني');
  await fireEvent.changeText(screen.getByLabelText('Name in English'), 'Rana Al-Qahtani');
  await fireEvent.changeText(screen.getByLabelText('University email'), email);
  await fireEvent.changeText(
    screen.getByLabelText('Password (at least 8 characters)'),
    'a-long-password',
  );
  // The department menu: open it, then choose under its college.
  await fireEvent.press(screen.getByRole('button', { name: 'Department, Choose a department' }));
  expect(screen.getByText('College of Computer and Cyber Sciences')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('radio', { name: 'Cybersecurity and Forensic Computing' }),
  );
}

it('says what is missing next to each field before sending anything', async () => {
  await renderWithProviders(<SignUpScreen />, 'en');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Check the fields marked above.')).toBeTruthy();
  expect(screen.getAllByText('Use at least 2 characters.')).toHaveLength(2);
  expect(screen.getByText('Enter a valid email in lowercase letters.')).toBeTruthy();
  expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
  expect(screen.getByText('Choose one.')).toBeTruthy();
  expect(mockSignUp).not.toHaveBeenCalled();
});

it('creates a student account and goes straight in', async () => {
  mockSignUp.mockResolvedValueOnce('signedIn');
  await renderWithProviders(<SignUpScreen />, 'en');
  await fillAccount();
  expect(screen.getByText('University number: 4519001')).toBeTruthy(); // read from the email
  await fireEvent.press(screen.getByRole('button', { name: 'Year 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockSignUp).toHaveBeenCalledWith({
    role: 'student',
    email: '4519001@upm.edu.sa',
    password: 'a-long-password',
    full_name_ar: 'رنا القحطاني',
    full_name_en: 'Rana Al-Qahtani',
    preferred_locale: 'en',
    department_id: 2,
    study_year: 2,
  });
});

it('sends a professor request and says an administrator will activate it', async () => {
  mockSignUp.mockResolvedValueOnce('pending');
  await renderWithProviders(<SignUpScreen />, 'en');
  await fireEvent.press(screen.getByRole('tab', { name: 'Professor' }));
  expect(screen.queryByRole('button', { name: 'Year 2' })).toBeNull();
  await fillAccount('m.alfaraj@upm.edu.sa');
  await fireEvent.press(screen.getByRole('button', { name: 'Prof.' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  expect(await screen.findByText('Request sent')).toBeTruthy();
  expect(screen.getByText(/Then sign in with m\.alfaraj@upm\.edu\.sa\.$/)).toBeTruthy();
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
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  const message =
    'An account with this email already exists. Sign in instead, or use another email.';
  await waitFor(() => expect(screen.getAllByText(message)).toHaveLength(2)); // field + summary
});

it.each([
  ['4519001@gmail.com', 'Use your university email, ending in @upm.edu.sa.'],
  [
    'r.alqahtani@upm.edu.sa',
    'Students use their university number as the email, for example 4510440@upm.edu.sa.',
  ],
])('explains the email rule for %s before sending', async (email, message) => {
  await renderWithProviders(<SignUpScreen />, 'en');
  await fillAccount(email);
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText(message)).toBeTruthy();
  expect(mockSignUp).not.toHaveBeenCalled();
});
