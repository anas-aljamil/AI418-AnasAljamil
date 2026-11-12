/** Shapes returned by the Mawjood API (backend/app/schemas.py). Timestamps are UTC ISO strings. */
import type { Language, StatusKey } from '@/theme/tokens';

export type Role = 'student' | 'professor' | 'admin';

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface College {
  college_id: number;
  code: string;
  name_ar: string;
  name_en: string;
}

export interface Department {
  department_id: number;
  code: string;
  name_ar: string;
  name_en: string;
  college: College;
}

export interface Office {
  office_id: number;
  building_code: string;
  floor: number;
  room_number: string;
}

export interface Me {
  user_id: number;
  email: string;
  role: Role;
  full_name_ar: string;
  full_name_en: string;
  preferred_locale: string;
  student?: { university_no: string; study_year: number; department: Department } | null;
  professor?: {
    honorific: Honorific;
    academic_rank: Rank;
    department: Department;
    office: Office | null;
  } | null;
}

export interface TokenResponse {
  access_token: string;
  access_expires_at: string;
  refresh_token: string | null;
  user: Me;
}

export type Honorific = 'dr' | 'prof' | 'mr' | 'ms' | 'eng';

/** POST /auth/signup (the client adds "client"). */
interface SignUpAccount {
  email: string;
  password: string;
  full_name_ar: string;
  full_name_en: string;
  preferred_locale: Language;
  department_id: number;
}
export type SignUpBody =
  | (SignUpAccount & { role: 'student'; study_year: number })
  | (SignUpAccount & { role: 'professor'; honorific: Honorific; academic_rank: Rank });

export interface ProfessorStatus {
  status: StatusKey;
  /** false: the schedule says "in office" but nobody confirmed it in the last 4 hours. */
  confirmed: boolean;
  source: 'override' | 'schedule' | 'none';
  note: string | null;
  until: string | null;
  /** Last manual update; null when the status comes from the schedule only. */
  updated_at: string | null;
}

export interface ProfessorSummary {
  professor_id: number;
  full_name_ar: string;
  full_name_en: string;
  honorific: Honorific;
  department: Department;
  office: Office | null;
  status: ProfessorStatus;
  has_office_hours_today: boolean;
  is_pinned?: boolean | null;
}

export type AppointmentStatus =
  'pending' | 'approved' | 'declined' | 'cancelled' | 'completed' | 'no_show';

export interface Person {
  user_id: number;
  full_name_ar: string;
  full_name_en: string;
}

export interface Appointment {
  appointment_id: number;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  /** Cancellation closes at this instant (1 hour before the start). */
  cancel_deadline: string;
  topic: Topic | null;
  note: string | null;
  student: Person;
  professor: Person & { honorific: Honorific; office: Office | null };
}

export type Topic = 'assignment' | 'exam_review' | 'advising' | 'other';
export type Rank = 'lecturer' | 'assistant_professor' | 'associate_professor' | 'professor';
export type ManualStatus = 'in_office' | 'in_class' | 'busy' | 'away';

export type BlockKind = 'office_hours' | 'class' | 'meeting';

/**
 * Weekly (day_of_week, 0 = Sunday, until ends_on when set) or once (on_date); dates are
 * "YYYY-MM-DD" in Riyadh. A weekly row does not happen on its skipped dates (2026-11-11).
 */
export interface Repeats {
  day_of_week: number | null;
  on_date: string | null;
  ends_on: string | null;
  skipped_dates: string[];
}

export interface Block extends Repeats {
  block_id: number;
  kind: BlockKind;
  start_time: string; // "HH:MM", Riyadh
  end_time: string;
  label: string | null;
}

/** A time the professor takes bookings in (working days, Riyadh "HH:MM"). */
export interface BookingPeriod extends Repeats {
  period_id: number;
  start_time: string;
  end_time: string;
}

/**
 * Closed hours for student messages (any day). An end at or before the start runs into the
 * next day; equal times close the whole day.
 */
export interface ChatClosure extends Repeats {
  closure_id: number;
  start_time: string;
  end_time: string;
}

export interface ProfessorDetail extends ProfessorSummary {
  academic_rank: Rank;
  today: { date: string; day_of_week: number; now_local_time: string; blocks: Block[] };
  /** When students can book; empty means the professor cannot be booked. */
  booking_periods: BookingPeriod[];
  /** The dates of this week and next with a booking time (the booking calendar). */
  booking_days: string[];
  /** Set while the professor's closed hours are on: students can write again at this time. */
  messages_closed_until: string | null;
}

/** A possible start (every 5 minutes in the booking periods). */
export interface Slot {
  starts_at: string;
  local_time: string;
  available: boolean;
  reason: 'past' | 'taken' | null;
  /** Longest appointment that can start here (5-minute steps; 0 when unavailable). */
  max_minutes: number;
}

export interface DaySlots {
  professor_id: number;
  date: string;
  /** The length offered first (15 minutes). */
  default_minutes: number;
  step_minutes: number;
  slots: Slot[];
}

/** GET/POST /me/status: the professor's own effective status. */
export interface MyStatus extends ProfessorStatus {
  schedule_status: StatusKey;
}

interface Account {
  user_id: number;
  email: string;
  full_name_ar: string;
  full_name_en: string;
  preferred_locale: 'ar' | 'en';
  is_active: boolean;
  created_at: string;
}

export interface AdminProfessor extends Account {
  department: Department;
  office: Office | null;
  honorific: Honorific;
  academic_rank: Rank;
}

export interface AdminStudent extends Account {
  university_no: string;
  department: Department;
  study_year: number;
}

export interface Participant extends Person {
  role: 'student' | 'professor';
  honorific: Honorific | null;
}

export interface ChatMessage {
  message_id: number;
  sender_role: 'student' | 'professor';
  mine: boolean;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  conversation_id: number;
  other: Participant;
  last_message: { body: string; mine: boolean; created_at: string } | null;
  unread_count: number;
  created_at: string;
  /** Set while the professor's closed hours are on: students can write again at this time. */
  closed_until: string | null;
}

export type NotificationType =
  | 'appointment_requested'
  | 'appointment_approved'
  | 'appointment_declined'
  | 'appointment_cancelled'
  | 'appointment_moved'
  | 'slot_freed'
  | 'new_message';

export interface AppNotification {
  notification_id: number;
  type: NotificationType;
  created_at: string;
  read_at: string | null;
  appointment_id: number | null;
  conversation_id: number | null;
  actor: Participant | null;
  starts_at: string | null;
}

export interface Unread {
  notifications: number;
  messages: number;
}
