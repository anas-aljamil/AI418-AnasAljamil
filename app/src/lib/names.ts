/** How people and places are written in each language (DESIGN.md Section 8). */
import type { TFunction } from 'i18next';

import type { Department, Honorific, Office } from '@/api/types';
import type { Language } from '@/theme/tokens';

interface Named {
  full_name_ar: string;
  full_name_en: string;
}

export function fullName(person: Named, language: Language): string {
  return language === 'ar' ? person.full_name_ar : person.full_name_en;
}

/** "Dr. Noura Al-Harbi" / "د. نورة الحربي". */
export function professorName(
  professor: Named & { honorific: Honorific },
  language: Language,
  t: TFunction,
): string {
  return `${t(`honorific.${professor.honorific}`)} ${fullName(professor, language)}`;
}

export function firstName(person: Named, language: Language): string {
  return fullName(person, language).split(' ')[0] ?? '';
}

export function departmentName(department: Department, language: Language): string {
  return language === 'ar' ? department.name_ar : department.name_en;
}

/** "Building A, room 214" / "مبنى A، غرفة 214". */
export function officeText(office: Office | null, t: TFunction): string {
  return office
    ? t('office.short', { building: office.building_code, room: office.room_number })
    : t('office.none');
}

/** Parts of a screen-reader label joined with the language's comma (", " or "، "). */
export function spokenList(parts: (string | null | undefined)[], t: TFunction): string {
  return parts.filter(Boolean).join(t('common.separator'));
}

/** "Building A, floor 2, room 214" / "مبنى A، الطابق 2، غرفة 214". */
export function officeFull(office: Office | null, t: TFunction): string {
  return office
    ? t('prof.office_full', {
        building: office.building_code,
        floor: office.floor,
        room: office.room_number,
      })
    : t('office.none');
}
