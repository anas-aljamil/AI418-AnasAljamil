/**
 * A professor as a flat nameplate row (design plan, Direction A): door at the start edge,
 * name and department, then the status label and "updated X ago" at the end edge.
 * With `onTogglePin`, a pin button sits beside the row as its own control.
 */
import { useTranslation } from 'react-i18next';
import Pin from 'lucide-react-native/icons/pin';

import type { ProfessorSummary } from '@/api/types';
import { departmentName, professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import type { Language } from '@/theme/tokens';
import { Door } from './Door';
import { describeStatus, StatusLabel } from './StatusLabel';
import { IconButton, ListRow } from './Surfaces';

interface ProfessorRowProps {
  professor: ProfessorSummary;
  now: Date;
  onTogglePin?: (professor: ProfessorSummary, pin: boolean) => void;
}

export function ProfessorRow({ professor, now, onTogglePin }: ProfessorRowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const name = professorName(professor, language, t);
  const department = departmentName(professor.department, language);
  const updatedAt = professor.status.updated_at ? new Date(professor.status.updated_at) : null;
  const { door, label, updated } = describeStatus(
    professor.status.status,
    professor.status.confirmed,
    updatedAt,
    now,
    language,
    t,
  );
  const pinned = !!professor.is_pinned;

  return (
    <ListRow
      leading={<Door status={door} size={32} />}
      title={name}
      subtitle={department}
      trailing={
        <StatusLabel
          status={professor.status.status}
          confirmed={professor.status.confirmed}
          updatedAt={updatedAt}
          now={now}
        />
      }
      accessibilityLabel={spokenList([name, department, label, updated], t)}
      after={
        onTogglePin ? (
          <IconButton
            label={t(pinned ? 'home.unpin' : 'home.pin', { name })}
            selected={pinned}
            onPress={() => onTogglePin(professor, !pinned)}
            // Filled when pinned; the label names what tapping does.
            icon={
              <Pin
                color={pinned ? colors.primary : colors.muted}
                fill={pinned ? colors.primary : 'none'}
                size={22}
                strokeWidth={1.75}
              />
            }
          />
        ) : null
      }
    />
  );
}
