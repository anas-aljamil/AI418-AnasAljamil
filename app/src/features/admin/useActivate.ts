import { useTranslation } from 'react-i18next';

import { useAdminSave } from '@/api/queries';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';

/** One tap to let an account sign in again (a professor who signed up, or one switched off). */
export function useActivate(resource: 'professors' | 'students') {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useAdminSave(resource);
  return (account: { user_id: number }, name: string, onDone?: () => void) =>
    save.mutate(
      { id: account.user_id, body: { is_active: true } },
      {
        onSuccess: () => {
          toast(t('admin.activated', { name }));
          onDone?.();
        },
        onError: (error) => toast(t(errorKey(error))),
      },
    );
}
