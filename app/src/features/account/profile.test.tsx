/** Edit profile (owner request S5b, 2026-11-18): names, a professor's email and office, the
 * photo mark. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
import type { Me } from '@/api/types';
import { PersonMark } from '@/components/Avatar';
import { renderWithProviders, testDepartment } from '@/test-utils';
import { ProfileSheet } from './AccountSheets';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockUpdateUser = jest.fn();
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ updateUser: mockUpdateUser }) }));
const mockApi = api as jest.MockedFunction<typeof api>;

const department = testDepartment(1, 'SE', 'هندسة البرمجيات', 'Software Engineering');
const student: Me = {
  user_id: 9,
  email: 's.almutairi@university.example',
  role: 'student',
  full_name_ar: 'سعد المطيري',
  full_name_en: 'Saad Al-Mutairi',
  preferred_locale: 'en',
  photo_updated_at: null,
  student: { university_no: 'S1001', study_year: 3, department },
};
const professor: Me = {
  user_id: 1,
  email: 'n.alharbi@university.example',
  role: 'professor',
  full_name_ar: 'نورة الحربي',
  full_name_en: 'Noura Al-Harbi',
  preferred_locale: 'en',
  photo_updated_at: null,
  professor: {
    honorific: 'dr',
    academic_rank: 'assistant_professor',
    department,
    office: null,
  },
};
const office = { office_id: 3, building_code: 'B', floor: 1, room_number: '105' };

beforeEach(() => {
  mockApi.mockReset();
  mockUpdateUser.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path.startsWith('/offices')) return { items: [office], total: 1, limit: 100, offset: 0 };
    return professor;
  });
});

it('saves only the names that changed, and keeps a student email with the administrator', async () => {
  await renderWithProviders(<ProfileSheet visible onClose={jest.fn()} user={student} />);
  expect(screen.queryByLabelText('University email')).toBeNull();
  expect(screen.getByText(/is your university number, so only the administrator/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Office/ })).toBeNull();
  // Expo Go has no photo picker; the sheet says where to add one.
  expect(
    screen.getByText('Add or change your photo in the browser version of Mawjood.'),
  ).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Name in English'), '  Saad M. Al-Mutairi ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/account', 'PATCH', {
      full_name_en: 'Saad M. Al-Mutairi',
    }),
  );
  expect(mockUpdateUser).toHaveBeenCalled();
});

it('asks a professor for the current password before changing the email', async () => {
  await renderWithProviders(<ProfileSheet visible onClose={jest.fn()} user={professor} />);
  expect(screen.queryByLabelText('Current password (needed to change the email)')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('University email'), 'N.AlHarbi@upm.edu.sa');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter your current password.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalledWith('/me/account', 'PATCH', expect.anything());

  await fireEvent.changeText(
    screen.getByLabelText('Current password (needed to change the email)'),
    'my-password',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/account', 'PATCH', {
      email: 'n.alharbi@upm.edu.sa',
      current_password: 'my-password',
    }),
  );
});

it('checks a professor email is at the university before sending', async () => {
  await renderWithProviders(<ProfileSheet visible onClose={jest.fn()} user={professor} />);
  await fireEvent.changeText(screen.getByLabelText('University email'), 'noura@gmail.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Use your university email, ending in @upm.edu.sa.')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalledWith('/me/account', 'PATCH', expect.anything());
});

it('lets a professor choose their office', async () => {
  await renderWithProviders(<ProfileSheet visible onClose={jest.fn()} user={professor} />);
  await fireEvent.press(await screen.findByRole('button', { name: /^Office, / }));
  await fireEvent.press(await screen.findByRole('radio', { name: /Building B/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/me/professor', 'PATCH', { office_id: 3 }),
  );
  // Nothing else changed, so the account itself is not sent.
  expect(mockApi).not.toHaveBeenCalledWith('/me/account', 'PATCH', expect.anything());
});

it('shows initials without a photo and does not ask for one', async () => {
  await renderWithProviders(<PersonMark userId={1} name="Noura Al-Harbi" />);
  // The mark is decorative (hidden from screen readers), so look among hidden elements.
  expect(screen.getByText('NH', { includeHiddenElements: true })).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled();
});

it('asks for the photo of this version and shows it instead of the initials', async () => {
  mockApi.mockResolvedValue({
    user_id: 1,
    content_type: 'image/jpeg',
    data: 'AAAA',
    updated_at: '2026-11-18T08:00:00Z',
  });
  await renderWithProviders(
    <PersonMark userId={1} photoVersion="2026-11-18T08:00:00Z" name="Noura Al-Harbi" />,
  );
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/users/1/photo?v=2026-11-18T08%3A00%3A00Z'),
  );
  await waitFor(() => expect(screen.queryByText('NH', { includeHiddenElements: true })).toBeNull());
});
