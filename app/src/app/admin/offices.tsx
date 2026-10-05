import { useTranslation } from 'react-i18next';

import { AdminCrudScreen } from '@/features/admin/AdminCrud';
import { officesConfig } from '@/features/admin/configs';

export default function OfficesAdmin() {
  const { t } = useTranslation();
  return <AdminCrudScreen config={officesConfig(t)} />;
}
