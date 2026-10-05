/** Admin forms: rules shown next to the field before anything is sent, then the right request. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api, ApiError } from '@/api/client';
import DepartmentsAdmin from '@/app/admin/departments';
import { renderWithProviders } from '@/test-utils';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;
const cs = { department_id: 1, code: 'CS', name_ar: 'علوم الحاسب', name_en: 'Computer Science' };

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string, method = 'GET') => {
    if (method === 'GET') return { items: [cs], total: 1, limit: 100, offset: 0 };
    if (method === 'DELETE') throw new ApiError(409, 'IN_USE', 'raw');
    return { ...cs, department_id: 2 };
  });
});

it('checks the fields before saving, then creates the department', async () => {
  await renderWithProviders(<DepartmentsAdmin />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getAllByText('Fill in this field.')).toHaveLength(3);
  expect(
    screen.getByText('Some details are not valid. Check the fields and try again.'),
  ).toBeTruthy();
  expect(mockApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false);

  await fireEvent.changeText(screen.getByLabelText('Code (capital English letters)'), 'm4');
  expect(screen.getByText('Use 2 to 10 capital English letters.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Code (capital English letters)'), 'math');
  await fireEvent.changeText(screen.getByLabelText('Name in Arabic'), 'الرياضيات');
  await fireEvent.changeText(screen.getByLabelText('Name in English'), 'Mathematics');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith('/admin/departments', 'POST', {
      code: 'MATH',
      name_ar: 'الرياضيات',
      name_en: 'Mathematics',
    }),
  );
});

it('asks before deleting and explains when the row is still in use', async () => {
  await renderWithProviders(<DepartmentsAdmin />);
  await fireEvent.press(await screen.findByText('Computer Science'));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByText('Delete Computer Science?')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);
  expect(
    await screen.findByText(
      'This is still in use. Move the professors, students or offices that use it first.',
    ),
  ).toBeTruthy();
  expect(mockApi).toHaveBeenCalledWith('/admin/departments/1', 'DELETE');
});
