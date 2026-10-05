import { useTranslation } from 'react-i18next';

import { useAdminList } from '@/api/queries';
import { AdminCrudScreen } from '@/features/admin/AdminCrud';
import { professorsConfig } from '@/features/admin/configs';

export default function ProfessorsAdmin() {
  const { t, i18n } = useTranslation();
  const departments = useAdminList('departments');
  const offices = useAdminList('offices');
  return (
    <AdminCrudScreen
      config={professorsConfig(
        t,
        i18n.language === 'ar' ? 'ar' : 'en',
        departments.data ?? [],
        offices.data ?? [],
      )}
    />
  );
}
