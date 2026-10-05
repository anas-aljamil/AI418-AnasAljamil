/** Data for the student screens, polled every 20 seconds (CLAUDE.md Section 5). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Language } from '@/theme/tokens';
import { api } from './client';
import { POLL_MS } from './queryClient';
import type {
  AppNotification,
  ChatMessage,
  Conversation,
  Unread,
  AdminProfessor,
  AdminStudent,
  Appointment,
  Block,
  DaySlots,
  Department,
  ManualStatus,
  MyStatus,
  Office,
  Page,
  ProfessorDetail,
  ProfessorSummary,
  Topic,
} from './types';

export const queryKeys = {
  pins: ['pins'] as const,
  professors: ['professors'] as const,
  department: (departmentId: number, language: Language) =>
    ['professors', 'department', departmentId, language] as const,
  search: (filters: SearchFilters, language: Language) =>
    ['professors', 'search', filters, language] as const,
  professor: (id: number) => ['professor', id] as const,
  slots: (id: number, date: string) => ['professor', id, 'slots', date] as const,
  departments: ['departments'] as const,
  appointments: ['appointments'] as const,
  appointmentList: (scope: 'upcoming' | 'past') => ['appointments', 'list', scope] as const,
  nextAppointment: ['appointments', 'next'] as const,
  requests: ['appointments', 'requests'] as const,
  myStatus: ['me', 'status'] as const,
  mySchedule: ['me', 'schedule'] as const,
  admin: (resource: AdminResource) => ['admin', resource] as const,
  conversations: ['chat'] as const,
  messages: (id: number) => ['chat', id] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
};

export interface SearchFilters {
  query: string;
  departmentIds?: number[];
  statuses?: string[];
  officeHoursToday?: boolean;
}

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

/**
 * Arabic-aware search by name or department (normalization happens in the API), with the
 * Search tab's filters. Runs only when there is a query or a filter.
 */
export function useProfessorSearch(filters: SearchFilters, language: Language) {
  const query = filters.query.trim();
  const params = new URLSearchParams({ lang: language, limit: '50' });
  if (query) params.set('q', query);
  for (const id of filters.departmentIds ?? []) params.append('department_id', String(id));
  for (const status of filters.statuses ?? []) params.append('status', status);
  if (filters.officeHoursToday) params.set('has_office_hours_today', 'true');
  const active =
    query.length > 0 ||
    !!filters.departmentIds?.length ||
    !!filters.statuses?.length ||
    !!filters.officeHoursToday;
  return useQuery({
    queryKey: queryKeys.search({ ...filters, query }, language),
    queryFn: () => api<Page<ProfessorSummary>>(`/professors?${params}`).then((page) => page.items),
    enabled: active,
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: () => api<Page<Department>>('/departments?limit=100').then((page) => page.items),
    staleTime: 10 * 60_000,
  });
}

/** A professor's profile with live status and today's timeline. */
export function useProfessor(id: number) {
  return useQuery({
    queryKey: queryKeys.professor(id),
    queryFn: () => api<ProfessorDetail>(`/professors/${id}`),
    enabled: id > 0,
    refetchInterval: POLL_MS,
  });
}

/** Bookable times on one Riyadh day; taken and past times come back marked unavailable. */
export function useSlots(id: number, date: string | null) {
  return useQuery({
    queryKey: queryKeys.slots(id, date ?? ''),
    queryFn: () => api<DaySlots>(`/professors/${id}/slots?date=${date}`),
    enabled: id > 0 && !!date,
  });
}

export interface BookingInput {
  professor_id: number;
  starts_at: string;
  topic: Topic | null;
  note: string | null;
}

export function useBook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (booking: BookingInput) => api<Appointment>('/appointments', 'POST', booking),
    onSettled: (_data, _error, booking) => {
      client.invalidateQueries({ queryKey: queryKeys.appointments });
      client.invalidateQueries({ queryKey: ['professor', booking.professor_id] });
    },
  });
}

export function useAppointments(scope: 'upcoming' | 'past') {
  return useQuery({
    queryKey: queryKeys.appointmentList(scope),
    queryFn: () =>
      api<Page<Appointment>>(`/appointments?scope=${scope}&limit=100`).then((page) => page.items),
    refetchInterval: POLL_MS,
  });
}

export type AppointmentAction = 'approve' | 'decline' | 'cancel' | 'complete' | 'no-show';

export function useAppointmentAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: AppointmentAction }) =>
      api<Appointment>(`/appointments/${id}/${action}`, 'POST'),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.appointments }),
  });
}

/** For professors: their upcoming appointments (pending requests and approved ones). */
export function useRequests() {
  return useQuery({
    queryKey: queryKeys.requests,
    queryFn: () =>
      api<Page<Appointment>>(
        '/appointments?scope=upcoming&status=pending&status=approved&limit=100',
      ).then((page) => page.items),
    refetchInterval: POLL_MS,
  });
}

export function useMyStatus() {
  return useQuery({
    queryKey: queryKeys.myStatus,
    queryFn: () => api<MyStatus>('/me/status'),
    refetchInterval: POLL_MS,
  });
}

export interface StatusInput {
  status: ManualStatus;
  note?: string | null;
  /** Return time (UTC ISO); without one the status lasts until the end of the Riyadh day. */
  expires_at?: string | null;
}

/** One-tap status change, shown at once and rolled back if the API refuses. */
export function useSetStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: StatusInput | null) =>
      input ? api<MyStatus>('/me/status', 'POST', input) : api<MyStatus>('/me/status', 'DELETE'),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: queryKeys.myStatus });
      const previous = client.getQueryData<MyStatus>(queryKeys.myStatus);
      if (input && previous) {
        client.setQueryData<MyStatus>(queryKeys.myStatus, {
          ...previous,
          status: input.status,
          confirmed: true,
          source: 'override',
          note: input.note ?? null,
          until: input.expires_at ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) =>
      client.setQueryData(queryKeys.myStatus, context?.previous),
    onSuccess: (status) => client.setQueryData(queryKeys.myStatus, status),
    onSettled: () => client.invalidateQueries({ queryKey: ['professor'] }),
  });
}

export function useMySchedule() {
  return useQuery({
    queryKey: queryKeys.mySchedule,
    queryFn: () => api<Page<Block>>('/me/schedule?limit=100').then((page) => page.items),
  });
}

export type BlockInput = Omit<Block, 'block_id'>;

export function useSaveBlock() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, block }: { id: number | null; block: BlockInput }) =>
      id === null
        ? api<Block>('/me/schedule', 'POST', block)
        : api<Block>(`/me/schedule/${id}`, 'PUT', block),
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.mySchedule });
      client.invalidateQueries({ queryKey: ['professor'] });
    },
  });
}

export function useDeleteBlock() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/me/schedule/${id}`, 'DELETE'),
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.mySchedule });
      client.invalidateQueries({ queryKey: ['professor'] });
    },
  });
}

export function useSlotLength() {
  return useMutation({
    mutationFn: (slotMinutes: 15 | 30) =>
      api<unknown>('/me/professor-settings', 'PATCH', { slot_minutes: slotMinutes }),
  });
}

// --- admin ------------------------------------------------------------------------

export type AdminResource = 'departments' | 'offices' | 'professors' | 'students';
export interface AdminRows {
  departments: Department;
  offices: Office;
  professors: AdminProfessor;
  students: AdminStudent;
}

export function useAdminList<R extends AdminResource>(resource: R) {
  return useQuery({
    queryKey: queryKeys.admin(resource),
    queryFn: () =>
      api<Page<AdminRows[R]>>(`/admin/${resource}?limit=100`).then((page) => page.items),
  });
}

/** Create (id null), update (id and body) or delete (id, body null) one admin row. */
export function useAdminSave(resource: AdminResource) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: Record<string, unknown> | null }) =>
      id === null
        ? api<unknown>(`/admin/${resource}`, 'POST', body)
        : body === null
          ? api<void>(`/admin/${resource}/${id}`, 'DELETE')
          : api<unknown>(`/admin/${resource}/${id}`, 'PATCH', body),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['admin'] });
      client.invalidateQueries({ queryKey: queryKeys.departments });
    },
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

// --- chat and notifications (P5) ------------------------------------------------

/** An open thread polls a little faster than lists (still within 15-30 s, CLAUDE.md Section 5). */
export const THREAD_POLL_MS = 15_000;

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => api<Page<Conversation>>('/conversations?limit=100').then((page) => page.items),
    refetchInterval: POLL_MS,
  });
}

/** The latest 100 messages, newest first (the thread list is inverted). */
export function useMessages(conversationId: number) {
  return useQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: () =>
      api<Page<ChatMessage>>(`/conversations/${conversationId}/messages?limit=100`).then(
        (page) => page.items,
      ),
    enabled: conversationId > 0,
    refetchInterval: THREAD_POLL_MS,
  });
}

/** Open (or reopen) the conversation with a professor (students) or a student (professors). */
export function useOpenConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (other: { professor_id: number } | { student_id: number }) =>
      api<Conversation>('/conversations', 'POST', other),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}

export function useSendMessage(conversationId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<ChatMessage>(`/conversations/${conversationId}/messages`, 'POST', { body }),
    onSuccess: (message) => {
      client.setQueryData<ChatMessage[]>(queryKeys.messages(conversationId), (current = []) => [
        message,
        ...current.filter((m) => m.message_id !== message.message_id),
      ]);
      client.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

/** Marks the other side's messages read (they see "Read") and clears the badge. */
export function useMarkConversationRead(conversationId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/conversations/${conversationId}/read`, 'POST'),
    onSuccess: () => {
      // Show the other side's messages as read at once; the refetch below confirms it.
      const readAt = new Date().toISOString();
      client.setQueryData<ChatMessage[]>(queryKeys.messages(conversationId), (current) =>
        current?.map((m) => (m.mine || m.read_at ? m : { ...m, read_at: readAt })),
      );
      client.invalidateQueries({ queryKey: queryKeys.conversations });
      client.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api<Page<AppNotification>>('/notifications?limit=50').then((page) => page.items),
    enabled,
    refetchInterval: POLL_MS,
  });
}

export function useUnread(enabled = true) {
  return useQuery({
    queryKey: queryKeys.unread,
    queryFn: () => api<Unread>('/notifications/unread'),
    enabled,
    refetchInterval: POLL_MS,
  });
}

/** Mark some notifications read, or all of them when ids is null. */
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[] | null) =>
      api<void>('/notifications/read', 'POST', ids === null ? {} : { ids }),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
