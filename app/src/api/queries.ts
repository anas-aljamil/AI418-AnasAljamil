/** Data for the student screens, polled every 20 seconds (CLAUDE.md Section 5). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Language } from '@/theme/tokens';
import { api } from './client';
import { POLL_MS } from './queryClient';
import type { Appointment, Page, ProfessorSummary } from './types';

export const queryKeys = {
  pins: ['pins'] as const,
  professors: ['professors'] as const,
  department: (departmentId: number, language: Language) =>
    ['professors', 'department', departmentId, language] as const,
  search: (query: string, language: Language) => ['professors', 'search', query, language] as const,
  nextAppointment: ['appointments', 'next'] as const,
};

export function usePins() {
  return useQuery({
    queryKey: queryKeys.pins,
    queryFn: () => api<Page<ProfessorSummary>>('/me/pins?limit=50').then((page) => page.items),
    refetchInterval: POLL_MS,
  });
}

/** Professors of one department, in office first, then by name (sorted by the API). */
export function useDepartmentProfessors(departmentId: number, language: Language) {
  return useQuery({
    queryKey: queryKeys.department(departmentId, language),
    queryFn: () =>
      api<Page<ProfessorSummary>>(
        `/professors?department_id=${departmentId}&lang=${language}&limit=50`,
      ).then((page) => page.items),
    enabled: departmentId > 0,
    refetchInterval: POLL_MS,
  });
}

/** Arabic-aware search by name or department (normalization happens in the API). */
export function useProfessorSearch(query: string, language: Language) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed, language),
    queryFn: () =>
      api<Page<ProfessorSummary>>(
        `/professors?q=${encodeURIComponent(trimmed)}&lang=${language}&limit=20`,
      ).then((page) => page.items),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  });
}

/** The soonest pending or approved appointment that has not ended, or null. */
export function useNextAppointment() {
  return useQuery({
    queryKey: queryKeys.nextAppointment,
    queryFn: () =>
      api<Page<Appointment>>(
        '/appointments?scope=upcoming&status=pending&status=approved&limit=1',
      ).then((page) => page.items[0] ?? null),
    refetchInterval: POLL_MS,
  });
}

type ProfessorLists = [readonly unknown[], ProfessorSummary[] | undefined][];

/** Pin or unpin, shown at once and rolled back if the API refuses (DESIGN.md Section 5). */
export function usePinToggle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ professor, pin }: { professor: ProfessorSummary; pin: boolean }) =>
      api<void>(`/me/pins/${professor.professor_id}`, pin ? 'PUT' : 'DELETE'),
    onMutate: async ({ professor, pin }) => {
      await client.cancelQueries({ queryKey: queryKeys.professors });
      await client.cancelQueries({ queryKey: queryKeys.pins });
      const lists: ProfessorLists = client.getQueriesData<ProfessorSummary[]>({
        queryKey: queryKeys.professors,
      });
      const pins = client.getQueryData<ProfessorSummary[]>(queryKeys.pins);
      const mark = (p: ProfessorSummary) =>
        p.professor_id === professor.professor_id ? { ...p, is_pinned: pin } : p;
      for (const [key, rows] of lists) if (rows) client.setQueryData(key, rows.map(mark));
      client.setQueryData<ProfessorSummary[]>(queryKeys.pins, (current = []) =>
        pin
          ? [...current.filter((p) => p.professor_id !== professor.professor_id), mark(professor)]
          : current.filter((p) => p.professor_id !== professor.professor_id),
      );
      return { lists, pins };
    },
    onError: (_error, _variables, context) => {
      for (const [key, rows] of context?.lists ?? []) client.setQueryData(key, rows);
      client.setQueryData(queryKeys.pins, context?.pins);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.pins });
      client.invalidateQueries({ queryKey: queryKeys.professors });
    },
  });
}
