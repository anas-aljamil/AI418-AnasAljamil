/**
 * A professor as a flat row (DESIGN.md Section 11, "The corridor"): the door at the start
 * edge, the name, then the status as a sentence that says what happens next ("In office until
 * 12:00 PM"), and the department where the list mixes departments. With `onTogglePin`, a pin
 * button sits beside the row as its own control.
 */
import { useTranslation } from 'react-i18next';
import Pin from 'lucide-react-native/icons/pin';

import type { ProfessorSummary } from '@/api/types';
import { departmentName, professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import type { Language } from '@/theme/tokens';
import { Door } from './Door';
import { statusSentence } from './StatusLabel';
import { IconButton, ListRow } from './Surfaces';

interface ProfessorRowProps {
  professor: ProfessorSummary;
  now: Date;
  /** Opens the professor's profile (one tap from Home or Search). */
  onPress?: (professor: ProfessorSummary) => void;
  onTogglePin?: (professor: ProfessorSummary, pin: boolean) => void;
  /** Open in the pane beside the list (desktop Search). */
  selected?: boolean;
  /** Off where every row is the same department (Home's department list). */
  showDepartment?: boolean;
}

export function ProfessorRow({
  professor,
  now,
  onPress,
  onTogglePin,
  selected,
  showDepartment = true,
}: ProfessorRowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const name = professorName(professor, language, t);
  const department = showDepartment ? departmentName(professor.department, language) : undefined;
  const { door, label, when, sentence } = statusSentence(professor.status, now, language, t);
  const pinned = !!professor.is_pinned;

  return (
    <ListRow
      leading={<Door status={door} size={32} />}
      title={name}
      detail={sentence}
      subtitle={department}
      onPress={onPress ? () => onPress(professor) : undefined}
      selected={selected}
      accessibilityLabel={spokenList([name, department, label, when], t)}
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
