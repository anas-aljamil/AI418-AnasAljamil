import { useTranslation } from 'react-i18next';

import { usePinToggle } from '@/api/queries';
import type { ProfessorSummary } from '@/api/types';
import { useToast } from '@/components/Toast';
import { professorName } from '@/lib/names';
import type { Language } from '@/theme/tokens';

/** Pin or unpin a professor and confirm it with a toast (or say it failed). */
export function usePinWithToast() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const pinToggle = usePinToggle();
  return (professor: ProfessorSummary, pin: boolean) => {
    const name = professorName(professor, language, t);
    pinToggle.mutate(
      { professor, pin },
      {
        onSuccess: () => toast(t(pin ? 'home.pinned' : 'home.unpinned', { name })),
        onError: () => toast(t('home.pin_failed')),
      },
    );
  };
}
