import type { Block, ProfessorDetail, ProfessorStatus } from '@/api/types';
import { NO_HABITS } from './habits';
import { nextOfficeHours, nextStep } from './nextStep';

// Monday 5 October 2026, 10:00 in Riyadh (07:00 UTC), as in the seed's demo moment.
const NOW = new Date('2026-10-05T07:00:00Z');

function block(kind: Block['kind'], start: string, end: string, id = 1): Block {
  return {
    block_id: id,
    kind,
    start_time: start,
    end_time: end,
    label: null,
    day_of_week: 1,
    on_date: null,
    ends_on: null,
    skipped_dates: [],
  };
}

function status(overrides: Partial<ProfessorStatus>): ProfessorStatus {
  return {
    status: 'in_office',
    confirmed: true,
    source: 'override',
    note: null,
    until: null,
    updated_at: '2026-10-05T06:50:00Z',
    ...overrides,
  };
}

function professor(
  current: Partial<ProfessorStatus>,
  extra: Partial<ProfessorDetail> = {},
): ProfessorDetail {
  return {
    professor_id: 1,
    full_name_ar: 'نورة الحربي',
    full_name_en: 'Noura Al-Harbi',
    honorific: 'dr',
    academic_rank: 'assistant_professor',
    department: {
      department_id: 1,
      code: 'AI',
      name_ar: 'الذكاء الاصطناعي',
      name_en: 'Artificial Intelligence',
      college: { college_id: 1, code: 'CCCS', name_ar: 'كلية', name_en: 'College' },
    },
    office: null,
    status: status(current),
    has_office_hours_today: true,
    today: {
      date: '2026-10-05',
      day_of_week: 1,
      now_local_time: '10:00',
      blocks: [block('office_hours', '09:00', '11:00'), block('office_hours', '13:00', '14:00', 2)],
    },
    week: [
      { date: '2026-10-05', day_of_week: 1, blocks: [] },
      { date: '2026-10-06', day_of_week: 2, blocks: [block('office_hours', '10:00', '12:00', 3)] },
    ],
    booking_periods: [
      {
        period_id: 1,
        start_time: '09:00',
        end_time: '11:00',
        day_of_week: 1,
        on_date: null,
        ends_on: null,
        skipped_dates: [],
      },
    ],
    booking_days: ['2026-10-05'],
    messages_closed_until: null,
    ...extra,
  };
}

describe('the next step', () => {
  it('says go when the professor confirmed being in', () => {
    const step = nextStep(professor({ until: '2026-10-05T08:00:00Z' }), NOW, NO_HABITS);
    expect(step.kind).toBe('go');
    expect(step.confidence).toBe('sure');
    expect(step.time).toBe('11:00');
  });

  it('is unsure and puts Message first when "in office" is only the timetable', () => {
    const step = nextStep(
      professor({ confirmed: false, source: 'schedule', updated_at: null }),
      NOW,
      NO_HABITS,
    );
    expect(step.kind).toBe('check_first');
    expect(step.confidence).toBe('unsure');
    expect(step.actions).toEqual(['message', 'book']);
    expect(step.reasons).toEqual(['from_timetable', 'not_confirmed']);
  });

  it('keeps Message first when unsure, even for a student who usually books', () => {
    const step = nextStep(professor({ confirmed: false, source: 'schedule' }), NOW, {
      book: 5,
      message: 0,
    });
    expect(step.actions[0]).toBe('message');
  });

  it('gives the return time of an away professor', () => {
    const step = nextStep(
      professor({ status: 'away', until: '2026-10-05T09:30:00Z' }),
      NOW,
      NO_HABITS,
    );
    expect(step.kind).toBe('back_later');
    expect(step.time).toBe('12:30');
    expect(step.actions).toEqual(['book', 'message']);
  });

  it('finds the next office hours later today', () => {
    const step = nextStep(
      professor({ status: 'away', source: 'schedule', updated_at: null }),
      NOW,
      NO_HABITS,
    );
    expect(step.kind).toBe('next_hours');
    expect(step.time).toBe('13:00');
    expect(step.date).toBe(null);
  });

  it('skips today when the professor is away for the rest of it', () => {
    const step = nextStep(
      professor({ status: 'away', until: '2026-10-05T21:00:00Z' }),
      NOW,
      NO_HABITS,
    );
    expect(step.kind).toBe('next_hours');
    expect(step.date).toBe('2026-10-06');
    expect(step.time).toBe('10:00');
  });

  it('puts the student usual move first once there is a habit', () => {
    const step = nextStep(professor({ status: 'away', until: '2026-10-05T09:30:00Z' }), NOW, {
      book: 0,
      message: 3,
    });
    expect(step.actions).toEqual(['message', 'book']);
    expect(step.reasons).toContain('habit_message');
  });

  it('leaves out moves that are not possible', () => {
    const step = nextStep(
      professor(
        { status: 'busy', until: '2026-10-05T08:00:00Z' },
        { booking_periods: [], messages_closed_until: '2026-10-05T09:00:00Z' },
      ),
      NOW,
      NO_HABITS,
    );
    expect(step.kind).toBe('wait');
    expect(step.actions).toEqual([]);
    expect(step.reasons).toContain('no_booking_times');
    expect(step.reasons).toContain('messages_closed');
  });

  it('suggests a message when no office hours are left this week', () => {
    const empty = professor(
      { status: 'away', source: 'schedule', updated_at: null },
      {
        week: [],
        today: { date: '2026-10-05', day_of_week: 1, now_local_time: '15:00', blocks: [] },
      },
    );
    expect(nextOfficeHours(empty, '15:00')).toBe(null);
    const step = nextStep(empty, NOW, NO_HABITS);
    expect(step.kind).toBe('no_hours');
    expect(step.actions[0]).toBe('message');
  });
});
