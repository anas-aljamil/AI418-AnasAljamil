/**
 * The admin list screens, each wired to its data: departments (grouped by college, with their
 * professor and student counts), offices, professors (quick view first) and students. The
 * Campus tab shows departments and offices behind one switch.
 */
import { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAdminList, useColleges } from '@/api/queries';
import { Segmented } from '@/components/Segmented';
import { AdminCrudScreen } from './AdminCrud';
import {
  departmentsConfig,
  officesConfig,
  professorsConfig,
  studentsConfig,
  type DepartmentCounts,
} from './configs';
import { ProfessorSummary } from './ProfessorSummary';

function useLanguage() {
  const { t, i18n } = useTranslation();
  return { t, language: i18n.language === 'ar' ? ('ar' as const) : ('en' as const) };
}

/** ?add=1 (from the overview's quick actions) opens the empty form; closing clears it. */
function useAddRequest() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  return { addRequested: add === '1', onAddClosed: () => router.setParams({ add: undefined }) };
}

export function DepartmentsAdmin({ top }: { top?: React.ReactNode }) {
  const { t, language } = useLanguage();
  const colleges = useColleges();
  const professors = useAdminList('professors');
  const students = useAdminList('students');
  const counts = useMemo(() => {
    const found: DepartmentCounts = new Map();
    const bump = (id: number, key: 'professors' | 'students') => {
      const entry = found.get(id) ?? { professors: 0, students: 0 };
      entry[key] += 1;
      found.set(id, entry);
    };
    for (const p of professors.data ?? []) bump(p.department.department_id, 'professors');
    for (const s of students.data ?? []) bump(s.department.department_id, 'students');
    return found;
  }, [professors.data, students.data]);
  return (
    <AdminCrudScreen
      top={top}
      config={departmentsConfig(t, language, colleges.data ?? [], counts)}
    />
  );
}

export function OfficesAdmin({ top }: { top?: React.ReactNode }) {
  const { t } = useTranslation();
  return <AdminCrudScreen top={top} config={officesConfig(t)} />;
}

export function CampusAdmin() {
  const { t } = useTranslation();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const shown = view === 'offices' ? 'offices' : 'departments';
  const top = (
    <Segmented
      options={[
        { value: 'departments', label: t('tabs.departments') },
        { value: 'offices', label: t('tabs.offices') },
      ]}
      value={shown}
      onChange={(next) => router.setParams({ view: next })}
    />
  );
  return shown === 'offices' ? <OfficesAdmin top={top} /> : <DepartmentsAdmin top={top} />;
}

export function ProfessorsAdmin() {
  const { t, language } = useLanguage();
  const departments = useAdminList('departments');
  const offices = useAdminList('offices');
  return (
    <AdminCrudScreen
      {...useAddRequest()}
      config={professorsConfig(t, language, departments.data ?? [], offices.data ?? [])}
      renderSummary={(professor, { edit, close }) => (
        <ProfessorSummary professor={professor} onEdit={edit} onClose={close} />
      )}
    />
  );
}

export function StudentsAdmin() {
  const { t, language } = useLanguage();
  const departments = useAdminList('departments');
  return (
    <AdminCrudScreen
      {...useAddRequest()}
      config={studentsConfig(t, language, departments.data ?? [])}
    />
  );
}
