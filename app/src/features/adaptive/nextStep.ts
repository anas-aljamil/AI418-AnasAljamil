/**
 * The adaptive layer (M3): what a student should do next about one professor, worked out from
 * rules, not a trained model, so every suggestion can say why. It changes the profile for the
 * situation (is the professor really in, and how sure are we?) and for the student (do they
 * usually book or message first?). It answers the storyboard's failure (M1, frame 3): the
 * timetable says "office hours" but nobody is there.
 *
 *   status in office, confirmed recently ........ "go"          sure (set by them) / likely
 *   in office by the timetable, not confirmed ... "check_first" unsure: message before going
 *   in class or busy ............................ "wait"        until the given time
 *   away with a return time ..................... "back_later"  likely: they said so
 *   away otherwise .............................. "next_hours"  the next office hours this week
 *   no office hours left this week .............. "no_hours"    unsure: message instead
 *
 * Actions are Book and Message, in the order that fits; once the student has made two or more
 * moves, the one they make more often goes first, except when the tip is unsure (then the safe
 * move, a message, stays first). Book is left out without booking times, Message while the
 * professor's message hours are closed.
 */
import type { ProfessorDetail } from '@/api/types';
import type { Habits } from './habits';

export type StepKind = 'go' | 'check_first' | 'wait' | 'back_later' | 'next_hours' | 'no_hours';
export type Confidence = 'sure' | 'likely' | 'unsure';
export type StepAction = 'book' | 'message';
export type Reason =
  | 'set_by_professor'
  | 'from_timetable'
  | 'not_confirmed'
  | 'return_time'
  | 'timetable_can_change'
  | 'habit_book'
  | 'habit_message'
  | 'no_booking_times'
  | 'messages_closed';

export interface NextStep {
  kind: StepKind;
  confidence: Confidence;
  /** "HH:MM" Riyadh: until when (go, wait), when back (back_later), when hours start. */
  time: string | null;
  /** For next_hours on a later day: that date ("YYYY-MM-DD"). */
  date: string | null;
  /** Best first; may be empty. */
  actions: StepAction[];
  reasons: Reason[];
}

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

function riyadhClock(iso: string): string {
  const local = new Date(new Date(iso).getTime() + RIYADH_OFFSET_MS);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

const hhmm = (time: string) => time.slice(0, 5);

/** The next office hours: later today (after `after`), else the first later day this week. */
export function nextOfficeHours(
  professor: ProfessorDetail,
  after: string | null,
): { date: string; time: string } | null {
  const { today } = professor;
  if (after !== null) {
    const later = today.blocks
      .filter((block) => block.kind === 'office_hours' && hhmm(block.start_time) > after)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    if (later) {
      return { date: today.date, time: hhmm(later.start_time) };
    }
  }
  for (const day of [...professor.week].sort((a, b) => a.date.localeCompare(b.date))) {
    if (day.date <= today.date) continue;
    const first = day.blocks
      .filter((block) => block.kind === 'office_hours')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    if (first) return { date: day.date, time: hhmm(first.start_time) };
  }
  return null;
}

export function nextStep(professor: ProfessorDetail, now: Date, habits: Habits): NextStep {
  const { status } = professor;
  const until = status.until && new Date(status.until) > now ? riyadhClock(status.until) : null;
  const byProfessor = status.source === 'override';
  const reasons: Reason[] = [];
  let kind: StepKind;
  let confidence: Confidence;
  let time: string | null = null;
  let date: string | null = null;
  let order: StepAction[];

  if (status.status === 'in_office' && status.confirmed) {
    kind = 'go';
    confidence = byProfessor ? 'sure' : 'likely';
    time = until;
    reasons.push(byProfessor ? 'set_by_professor' : 'from_timetable');
    order = ['message', 'book'];
  } else if (status.status === 'in_office') {
    kind = 'check_first';
    confidence = 'unsure';
    reasons.push('from_timetable', 'not_confirmed');
    order = ['message', 'book'];
  } else if (status.status === 'in_class' || status.status === 'busy') {
    kind = 'wait';
    confidence = byProfessor ? 'sure' : 'likely';
    time = until;
    reasons.push(byProfessor ? 'set_by_professor' : 'from_timetable');
    order = ['book', 'message'];
  } else if (status.status === 'away' && byProfessor && until && until !== '00:00') {
    kind = 'back_later';
    confidence = 'likely';
    time = until;
    reasons.push('return_time');
    order = ['book', 'message'];
  } else {
    // Away for the rest of today (by the professor) skips today; otherwise later today counts.
    const awayToday = byProfessor && status.status === 'away';
    const next = nextOfficeHours(
      professor,
      awayToday ? null : hhmm(professor.today.now_local_time),
    );
    if (next) {
      kind = 'next_hours';
      confidence = 'likely';
      time = next.time;
      if (next.date !== professor.today.date) date = next.date;
      reasons.push('timetable_can_change');
      order = ['book', 'message'];
    } else {
      kind = 'no_hours';
      confidence = 'unsure';
      reasons.push('timetable_can_change');
      order = ['message', 'book'];
    }
  }

  // The student's own habit, once there is one, decides which move comes first.
  const total = habits.book + habits.message;
  if (confidence !== 'unsure' && total >= 2 && habits.book !== habits.message) {
    const usual: StepAction = habits.message > habits.book ? 'message' : 'book';
    order = [usual, ...order.filter((action) => action !== usual)];
    reasons.push(usual === 'message' ? 'habit_message' : 'habit_book');
  }

  const bookable = professor.booking_periods.length > 0;
  const closed =
    !!professor.messages_closed_until && new Date(professor.messages_closed_until) > now;
  if (!bookable) reasons.push('no_booking_times');
  if (closed) reasons.push('messages_closed');
  const actions = order.filter((action) => (action === 'book' ? bookable : !closed));

  return { kind, confidence, time, date, actions, reasons };
}
