/** Shapes returned by the Mawjood API (backend/app/schemas.py). Timestamps are UTC ISO strings. */
import type { StatusKey } from '@/theme/tokens';

export type Role = 'student' | 'professor' | 'admin';

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Department {
  department_id: number;
  code: string;
  name_ar: string;
  name_en: string;
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
  professor?: { honorific: Honorific; department: Department; office: Office | null } | null;
}

export interface TokenResponse {
  access_token: string;
  access_expires_at: string;
  refresh_token: string | null;
  user: Me;
}

export type Honorific = 'dr' | 'prof' | 'mr' | 'ms' | 'eng';

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

export interface Appointment {
  appointment_id: number;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  topic: string | null;
  professor: {
    user_id: number;
    full_name_ar: string;
    full_name_en: string;
    honorific: Honorific;
    office: Office | null;
  };
}
