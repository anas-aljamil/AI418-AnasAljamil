import { useTranslation } from 'react-i18next';

import { useAdminList } from '@/api/queries';
import { AdminCrudScreen } from '@/features/admin/AdminCrud';
import { studentsConfig } from '@/features/admin/configs';

export default function StudentsAdmin() {
  const { t, i18n } = useTranslation();
  const departments = useAdminList('departments');
  return (
    <AdminCrudScreen
      config={studentsConfig(t, i18n.language === 'ar' ? 'ar' : 'en', departments.data ?? [])}
    />
  );
}
