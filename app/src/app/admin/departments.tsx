import { useTranslation } from 'react-i18next';

import { useColleges } from '@/api/queries';
import { AdminCrudScreen } from '@/features/admin/AdminCrud';
import { departmentsConfig } from '@/features/admin/configs';

export default function DepartmentsAdmin() {
  const { t, i18n } = useTranslation();
  const colleges = useColleges();
  return (
    <AdminCrudScreen
      config={departmentsConfig(t, i18n.language === 'ar' ? 'ar' : 'en', colleges.data ?? [])}
    />
  );
}
