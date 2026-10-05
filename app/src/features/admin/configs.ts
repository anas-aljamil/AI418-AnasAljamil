/** Field rules and display for each admin table (mirroring backend/app/schemas.py). */
import type { TFunction } from 'i18next';

import type { AdminProfessor, AdminStudent, Department, Office } from '@/api/types';
import { departmentName, fullName, officeFull } from '@/lib/names';
import { patterns } from '@/lib/validation';
import type { Language } from '@/theme/tokens';
import { required, type AdminConfig, type FieldSpec } from './AdminCrud';

const matches = (pattern: RegExp, key: string) => (value: string) =>
  required(value) ?? (pattern.test(value.trim()) ? null : key);
const minLength = (n: number, key: string) => (value: string) =>
  required(value) ?? (value.trim().length >= n ? null : key);

export function departmentsConfig(t: TFunction, language: Language): AdminConfig<'departments'> {
  return {
    resource: 'departments',
    title: t('tabs.departments'),
    idOf: (d) => d.department_id,
    titleOf: (d) => departmentName(d, language),
    subtitleOf: (d) => d.code,
    fields: [
      {
        type: 'text',
        key: 'code',
        label: t('admin.code'),
        upper: true,
        maxLength: 10,
        validate: matches(patterns.departmentCode, 'admin.code_format'),
      },
      {
        type: 'text',
        key: 'name_ar',
        label: t('admin.name_ar'),
        maxLength: 100,
        validate: minLength(2, 'admin.name_short'),
      },
      {
        type: 'text',
        key: 'name_en',
        label: t('admin.name_en'),
        maxLength: 100,
        validate: minLength(2, 'admin.name_short'),
      },
    ],
    valuesOf: (d: Department | null) => ({
      code: d?.code ?? '',
      name_ar: d?.name_ar ?? '',
      name_en: d?.name_en ?? '',
    }),
    bodyOf: (v) => ({
      code: v.code!.trim(),
      name_ar: v.name_ar!.trim(),
      name_en: v.name_en!.trim(),
    }),
  };
}

export function officesConfig(t: TFunction): AdminConfig<'offices'> {
  return {
    resource: 'offices',
    title: t('tabs.offices'),
    idOf: (o) => o.office_id,
    titleOf: (o) => officeFull(o, t),
    fields: [
      {
        type: 'text',
        key: 'building_code',
        label: t('admin.building'),
        upper: true,
        maxLength: 10,
        validate: matches(patterns.building, 'admin.building_format'),
      },
      {
        type: 'text',
        key: 'floor',
        label: t('admin.floor'),
        keyboard: 'number-pad',
        maxLength: 2,
        validate: (value) =>
          required(value) ??
          (/^\d{1,2}$/.test(value) && Number(value) <= 20 ? null : 'admin.floor_range'),
      },
      {
        type: 'text',
        key: 'room_number',
        label: t('admin.room'),
        upper: true,
        maxLength: 10,
        validate: matches(patterns.room, 'admin.room_format'),
      },
    ],
    valuesOf: (o: Office | null) => ({
      building_code: o?.building_code ?? '',
      floor: o ? String(o.floor) : '',
      room_number: o?.room_number ?? '',
    }),
    bodyOf: (v) => ({
      building_code: v.building_code!.trim(),
      floor: Number(v.floor),
      room_number: v.room_number!.trim(),
    }),
  };
}

/** Fields every account has (email, password, names, language). */
function accountFields(t: TFunction): FieldSpec[] {
  return [
    {
      type: 'text',
      key: 'email',
      label: t('admin.email'),
      keyboard: 'email-address',
      maxLength: 254,
      validate: (v) => required(v) ?? (patterns.email.test(v.trim()) ? null : 'admin.email_format'),
    },
    {
      type: 'text',
      key: 'password',
      label: t('admin.password'),
      secure: true,
      maxLength: 128,
      only: 'create',
      validate: (v) => (v.length >= 8 ? null : 'admin.password_short'),
    },
    {
      type: 'text',
      key: 'password',
      label: t('admin.password_edit'),
      secure: true,
      maxLength: 128,
      only: 'edit',
      validate: (v) => (!v || v.length >= 8 ? null : 'admin.password_short'),
    },
    {
      type: 'text',
      key: 'full_name_ar',
      label: t('admin.name_ar'),
      maxLength: 100,
      validate: minLength(2, 'admin.name_short'),
    },
    {
      type: 'text',
      key: 'full_name_en',
      label: t('admin.name_en'),
      maxLength: 100,
      validate: minLength(2, 'admin.name_short'),
    },
    {
      type: 'choice',
      key: 'preferred_locale',
      label: t('admin.language'),
      options: [
        { value: 'ar', label: t('settings.language_ar') },
        { value: 'en', label: t('settings.language_en') },
      ],
    },
  ];
}

function activeField(t: TFunction): FieldSpec {
  return {
    type: 'choice',
    key: 'is_active',
    label: t('admin.active'),
    only: 'edit',
    options: [
      { value: 'true', label: t('admin.active') },
      { value: 'false', label: t('admin.deactivated') },
    ],
  };
}

function accountBody(v: Record<string, string>, editing: boolean) {
  return {
    email: v.email!.trim(),
    ...(v.password ? { password: v.password } : {}),
    full_name_ar: v.full_name_ar!.trim(),
    full_name_en: v.full_name_en!.trim(),
    preferred_locale: v.preferred_locale,
    ...(editing ? { is_active: v.is_active === 'true' } : {}),
  };
}

function departmentOptions(departments: Department[], language: Language) {
  return departments.map((d) => ({
    value: String(d.department_id),
    label: departmentName(d, language),
  }));
}

export function professorsConfig(
  t: TFunction,
  language: Language,
  departments: Department[],
  offices: Office[],
): AdminConfig<'professors'> {
  return {
    resource: 'professors',
    title: t('tabs.professors'),
    person: true,
    idOf: (p) => p.user_id,
    titleOf: (p) => fullName(p, language),
    subtitleOf: (p) =>
      t('admin.person_line', {
        department: departmentName(p.department, language),
        email: p.email,
      }),
    inactive: (p) => !p.is_active,
    fields: [
      ...accountFields(t),
      {
        type: 'choice',
        key: 'department_id',
        label: t('admin.department'),
        options: departmentOptions(departments, language),
      },
      {
        type: 'choice',
        key: 'office_id',
        label: t('admin.office'),
        options: [
          { value: '', label: t('admin.no_office') },
          ...offices.map((o) => ({ value: String(o.office_id), label: officeFull(o, t) })),
        ],
      },
      {
        type: 'choice',
        key: 'honorific',
        label: t('admin.honorific'),
        options: (['dr', 'prof', 'mr', 'ms', 'eng'] as const).map((h) => ({
          value: h,
          label: t(`honorific.${h}`),
        })),
      },
      {
        type: 'choice',
        key: 'academic_rank',
        label: t('admin.rank'),
        options: (
          ['lecturer', 'assistant_professor', 'associate_professor', 'professor'] as const
        ).map((r) => ({ value: r, label: t(`rank.${r}`) })),
      },
      {
        type: 'choice',
        key: 'slot_minutes',
        label: t('schedule.slot_length'),
        options: [
          { value: '15', label: t('schedule.minutes_15') },
          { value: '30', label: t('schedule.minutes_30') },
        ],
      },
      activeField(t),
    ],
    valuesOf: (p: AdminProfessor | null) => ({
      email: p?.email ?? '',
      password: '',
      full_name_ar: p?.full_name_ar ?? '',
      full_name_en: p?.full_name_en ?? '',
      preferred_locale: p?.preferred_locale ?? 'ar',
      department_id: String(p?.department.department_id ?? departments[0]?.department_id ?? ''),
      office_id: p?.office ? String(p.office.office_id) : '',
      honorific: p?.honorific ?? 'dr',
      academic_rank: p?.academic_rank ?? 'assistant_professor',
      slot_minutes: String(p?.slot_minutes ?? 15),
      is_active: String(p?.is_active ?? true),
    }),
    bodyOf: (v, editing) => ({
      ...accountBody(v, editing),
      department_id: Number(v.department_id),
      office_id: v.office_id ? Number(v.office_id) : null,
      honorific: v.honorific,
      academic_rank: v.academic_rank,
      slot_minutes: Number(v.slot_minutes),
    }),
  };
}

export function studentsConfig(
  t: TFunction,
  language: Language,
  departments: Department[],
): AdminConfig<'students'> {
  return {
    resource: 'students',
    title: t('tabs.students'),
    person: true,
    idOf: (s) => s.user_id,
    titleOf: (s) => fullName(s, language),
    subtitleOf: (s) =>
      t('admin.person_line', {
        department: departmentName(s.department, language),
        email: s.email,
      }),
    inactive: (s) => !s.is_active,
    fields: [
      ...accountFields(t),
      {
        type: 'text',
        key: 'university_no',
        label: t('admin.university_no'),
        upper: true,
        maxLength: 12,
        validate: matches(patterns.universityNo, 'admin.university_no_format'),
      },
      {
        type: 'choice',
        key: 'department_id',
        label: t('admin.department'),
        options: departmentOptions(departments, language),
      },
      {
        type: 'choice',
        key: 'study_year',
        label: t('admin.study_year'),
        options: [1, 2, 3, 4, 5, 6].map((y) => ({ value: String(y), label: String(y) })),
      },
      activeField(t),
    ],
    valuesOf: (s: AdminStudent | null) => ({
      email: s?.email ?? '',
      password: '',
      full_name_ar: s?.full_name_ar ?? '',
      full_name_en: s?.full_name_en ?? '',
      preferred_locale: s?.preferred_locale ?? 'ar',
      university_no: s?.university_no ?? '',
      department_id: String(s?.department.department_id ?? departments[0]?.department_id ?? ''),
      study_year: String(s?.study_year ?? 1),
      is_active: String(s?.is_active ?? true),
    }),
    bodyOf: (v, editing) => ({
      ...accountBody(v, editing),
      university_no: v.university_no!.trim(),
      department_id: Number(v.department_id),
      study_year: Number(v.study_year),
    }),
  };
}
