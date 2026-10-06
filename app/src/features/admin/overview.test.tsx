/**
 * Admin overview and lists: accounts waiting for activation get a one-tap Activate (a partial
 * update with is_active only), the numbers open their lists, the people lists filter by
 * active state, and a professor opens as a quick view first, with Edit inside it.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
import { renderWithProviders, testCollege, testDepartment } from '@/test-utils';
import { AdminOverview } from './Overview';
import { ProfessorsAdmin } from './screens';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: { navigate: (href: unknown) => mockNavigate(href), setParams: () => undefined },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useUser: () => ({ user_id: 16, full_name_ar: 'سلمى الراشد', full_name_en: 'Salma Al-Rashid' }),
}));

const se = testDepartment(1, 'SE', 'هندسة البرمجيات', 'Software Engineering');
const account = (user_id: number, en: string, ar: string, is_active: boolean) => ({
  user_id,
  email: `${en.split(' ')[0]!.toLowerCase()}@university.example`,
  full_name_ar: ar,
  full_name_en: en,
  preferred_locale: 'ar',
  is_active,
  created_at: '2026-10-01T09:00:00Z',
});
const professors = [
  {
    ...account(1, 'Noura Al-Harbi', 'نورة الحربي', true),
    department: se,
    office: { office_id: 1, building_code: 'A', floor: 2, room_number: '214' },
    honorific: 'dr',
    academic_rank: 'assistant_professor',
    slot_minutes: 15,
    open_messages: false,
  },
  {
    ...account(20, 'Mansour Al-Faraj', 'منصور الفرج', false),
    department: se,
    office: null,
    honorific: 'dr',
    academic_rank: 'lecturer',
    slot_minutes: 30,
    open_messages: true,
  },
];
const students = [
  {
    ...account(9, 'Saad Al-Mutairi', 'سعد المطيري', true),
    university_no: 'S1',
    department: se,
    study_year: 3,
  },
];
const page = (items: unknown[]) => ({ items, total: items.length, limit: 100, offset: 0 });

beforeEach(() => {
  mockApi.mockReset();
  mockNavigate.mockReset();
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    if (method === 'PATCH') return {};
    if (path.startsWith('/admin/professors')) return page(professors);
    if (path.startsWith('/admin/students')) return page(students);
    if (path.startsWith('/admin/departments')) return page([se]);
    if (path.startsWith('/admin/offices')) return page([professors[0]!.office]);
    if (path.startsWith('/colleges')) return page([testCollege]);
    if (path.startsWith('/appointments')) {
      return page([
        { appointment_id: 7, status: 'pending', professor: { user_id: 1 } },
        { appointment_id: 6, status: 'approved', professor: { user_id: 1 } },
      ]);
    }
    if (path === '/professors/1') {
      return { status: { status: 'in_office', confirmed: true, updated_at: null } };
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
});

it('lists accounts waiting for activation and activates one in a tap', async () => {
  await renderWithProviders(<AdminOverview />);
  expect(await screen.findByText('Waiting for activation (1)')).toBeTruthy();
  expect(screen.getByText('Signed in as Salma Al-Rashid')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Activate Mansour Al-Faraj' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/admin/professors/20', 'PATCH', { is_active: true }),
  );
  expect(await screen.findByText('Mansour Al-Faraj can sign in now')).toBeTruthy();
});

it('shows the numbers, and each opens its list', async () => {
  await renderWithProviders(<AdminOverview />);
  const tile = await screen.findByRole('button', { name: 'Professors: 2, Not active: 1' });
  expect(screen.getByLabelText('Upcoming appointments: 2, Waiting for approval: 1')).toBeTruthy();
  await fireEvent.press(tile);
  expect(mockNavigate).toHaveBeenCalledWith('/admin/professors');
  await fireEvent.press(screen.getByRole('button', { name: 'Offices: 1' }));
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: '/admin/campus',
    params: { view: 'offices' },
  });
});

it('filters people by active state and opens a professor as a quick view first', async () => {
  await renderWithProviders(<ProfessorsAdmin />);
  expect(await screen.findByText('Total: 2, not active: 1')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Not active' }));
  expect(screen.queryByText('Noura Al-Harbi')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'All' }));

  await fireEvent.press(screen.getByLabelText(/^Noura Al-Harbi, /));
  expect(await screen.findByText('In office')).toBeTruthy();
  expect(screen.getByText('2 (waiting for approval: 1)')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit details' }));
  expect(await screen.findByText('Edit professor')).toBeTruthy();
  expect(screen.getByRole('switch', { name: 'Account active' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Office, Building A/ })).toBeTruthy();
});

it("never fills in the admin's own saved email and password when adding an account", async () => {
  await renderWithProviders(<ProfessorsAdmin />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add' }));
  const email = screen.getByLabelText('University email');
  const password = screen.getByLabelText('Password (at least 8 characters)');
  expect(email.props.value).toBe('');
  expect(email.props.autoComplete).toBe('off');
  expect(email.props.importantForAutofill).toBe('no');
  expect(password.props.autoComplete).toBe('new-password');
  expect(password.props.textContentType).toBe('none');
});
