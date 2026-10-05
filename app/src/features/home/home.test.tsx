/**
 * Student home (DESIGN.md 7.2) with the API mocked: pinned statuses visible without a tap,
 * the next appointment, the department list, and the empty, error and search states.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api, ApiError } from '@/api/client';
import type { Appointment, Me, ProfessorSummary } from '@/api/types';
import HomeScreen from '@/app/(student)/home';
import { renderWithProviders } from '@/test-utils';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const computerScience = {
  department_id: 1,
  code: 'CS',
  name_ar: 'علوم الحاسب',
  name_en: 'Computer Science',
};
const mockUser = {
  user_id: 9,
  role: 'student',
  full_name_ar: 'سعد المطيري',
  full_name_en: 'Saad Al-Mutairi',
  student: { university_no: 'S1001', study_year: 3, department: computerScience },
} as Me;
jest.mock('@/auth/AuthProvider', () => ({ useUser: () => mockUser }));

const mockApi = api as jest.MockedFunction<typeof api>;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function professor(
  id: number,
  name: string,
  status: ProfessorSummary['status']['status'],
  extra: Partial<ProfessorSummary> = {},
): ProfessorSummary {
  return {
    professor_id: id,
    full_name_ar: name,
    full_name_en: name,
    honorific: 'dr',
    department: computerScience,
    office: { office_id: 1, building_code: 'A', floor: 2, room_number: '214' },
    status: {
      status,
      confirmed: true,
      source: 'override',
      note: null,
      until: null,
      updated_at: minutesAgo(3),
    },
    has_office_hours_today: true,
    is_pinned: false,
    ...extra,
  };
}

const noura = professor(1, 'Noura Al-Harbi', 'in_office', { is_pinned: true });
const khalid = professor(2, 'Khalid Al-Otaibi', 'away');
const appointment: Appointment = {
  appointment_id: 7,
  status: 'pending',
  starts_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  ends_at: new Date(Date.now() + 2 * 86_400_000 + 900_000).toISOString(),
  cancel_deadline: new Date(Date.now() + 2 * 86_400_000 - 3_600_000).toISOString(),
  topic: null,
  note: null,
  student: { user_id: 9, full_name_ar: 'سعد المطيري', full_name_en: 'Saad Al-Mutairi' },
  professor: {
    user_id: 1,
    full_name_ar: 'نورة الحربي',
    full_name_en: 'Noura Al-Harbi',
    honorific: 'dr',
    office: { office_id: 1, building_code: 'A', floor: 2, room_number: '214' },
  },
};

type Routes = Record<string, unknown | (() => unknown)>;
function serve(routes: Routes) {
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    const match = Object.keys(routes).find((prefix) => `${method} ${path}`.startsWith(prefix));
    if (!match) throw new Error(`unexpected ${method} ${path}`);
    const answer = routes[match];
    return typeof answer === 'function' ? (answer as () => unknown)() : answer;
  });
}
const page = (items: unknown[]) => ({ items, total: items.length, limit: 50, offset: 0 });
const standard: Routes = {
  'GET /me/pins': page([noura]),
  'GET /professors?department_id=1': page([noura, khalid]),
  'GET /appointments': page([appointment]),
};

beforeEach(() => mockApi.mockReset());

it('shows pinned statuses, the next appointment and the department with no taps', async () => {
  serve(standard);
  await renderWithProviders(<HomeScreen />);
  expect(
    await screen.findByLabelText('Dr. Noura Al-Harbi, In office, updated 3 min ago'),
  ).toBeTruthy();
  expect(screen.getByText(/Good (morning|afternoon|evening), Saad/)).toBeTruthy();
  expect(await screen.findByText('Waiting for approval')).toBeTruthy();
  expect(screen.getByText('Building A, room 214')).toBeTruthy();
  expect(
    await screen.findByLabelText('Dr. Khalid Al-Otaibi, Computer Science, Away, updated 3 min ago'),
  ).toBeTruthy();
});

it('invites the student to search and pin when nothing is pinned', async () => {
  serve({ ...standard, 'GET /me/pins': page([]) });
  await renderWithProviders(<HomeScreen />);
  expect(await screen.findByText('No professors pinned yet')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Search professors' })).toBeTruthy();
});

it('says what went wrong when a section cannot load, and retries', async () => {
  let pinsFail = true;
  serve({
    ...standard,
    'GET /me/pins': () => {
      if (pinsFail) throw new ApiError(0, 'NETWORK', 'unreachable');
      return page([noura]);
    },
  });
  await renderWithProviders(<HomeScreen />);
  expect(
    await screen.findByText(
      "Can't reach the Mawjood server. Check your connection, then try again.",
    ),
  ).toBeTruthy();
  pinsFail = false;
  await fireEvent.press(screen.getAllByRole('button', { name: 'Try again' })[0]!);
  expect(
    await screen.findByLabelText('Dr. Noura Al-Harbi, In office, updated 3 min ago'),
  ).toBeTruthy();
});

it('searches as you type and pins from the results', async () => {
  serve({
    ...standard,
    'GET /professors?lang=en&limit=50&q=khalid': page([khalid]),
    'PUT /me/pins/2': undefined,
  });
  await renderWithProviders(<HomeScreen />);
  await fireEvent.changeText(screen.getByLabelText('Search professors'), 'khalid');
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith(expect.stringContaining('q=khalid')));
  expect(screen.getByText('Results')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: 'Pin Dr. Khalid Al-Otaibi' }));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/me/pins/2', 'PUT'));
  expect(await screen.findByText('Dr. Khalid Al-Otaibi is pinned')).toBeTruthy();
});

it('says so when no professor matches', async () => {
  serve({ ...standard, 'GET /professors?lang=en&limit=50&q=zzz': page([]) });
  await renderWithProviders(<HomeScreen />);
  await fireEvent.changeText(screen.getByLabelText('Search professors'), 'zzz');
  expect(await screen.findByText(/No professor matches “zzz”/)).toBeTruthy();
});
