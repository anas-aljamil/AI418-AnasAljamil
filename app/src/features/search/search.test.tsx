/** Search tab (DESIGN.md 7.3): filters become API parameters and empty results say so. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/api/client';
import SearchScreen from '@/app/(student)/search';
import { renderWithProviders } from '@/test-utils';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;
const page = (items: unknown[]) => ({ items, total: items.length, limit: 50, offset: 0 });

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path.startsWith('/departments')) {
      return page([
        { department_id: 3, code: 'IS', name_ar: 'نظم المعلومات', name_en: 'Information Systems' },
      ]);
    }
    if (path.startsWith('/professors?')) return page([]);
    throw new Error(`unexpected ${path}`);
  });
});

it('asks for a search or a filter before showing anything', async () => {
  await renderWithProviders(<SearchScreen />);
  expect(screen.getByText('Search by name or department, or choose a filter.')).toBeTruthy();
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/professors'))).toBe(false);
});

it('sends the status, office-hours and department filters to the API', async () => {
  await renderWithProviders(<SearchScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'In office' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Office hours today' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Information Systems' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith(
      '/professors?lang=en&limit=50&department_id=3&status=in_office&has_office_hours_today=true',
    ),
  );
  expect(await screen.findByText('No professor matches these filters.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear search and filters' }));
  expect(screen.getByRole('button', { name: 'In office' })).not.toBeSelected();
});
