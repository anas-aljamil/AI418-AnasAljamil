/**
 * Professor quick view (admin): tapping a professor shows who they are and how they stand
 * before any form: the live status with its door (active accounts only; students cannot see an
 * inactive professor), department and college, office, email, usual appointment length,
 * messages setting and upcoming appointments. Edit opens the form; a not-active account can be
 * activated here in one tap.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppointments, useProfessor } from '@/api/queries';
import type { AdminProfessor } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SkeletonRow } from '@/components/Placeholders';
import { StatusLabel } from '@/components/StatusLabel';
import { Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { departmentName, fullName, officeFull, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, type Language } from '@/theme/tokens';
import { Initials } from './parts';
import { useActivate } from './useActivate';

interface ProfessorSummaryProps {
  professor: AdminProfessor;
  onEdit: () => void;
  onClose: () => void;
}

export function ProfessorSummary({ professor, onEdit, onClose }: ProfessorSummaryProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const active = professor.is_active;
  const detail = useProfessor(active ? professor.user_id : 0);
  const upcoming = useAppointments('upcoming');
  const activate = useActivate('professors');
  const name = fullName(professor, language);
  const mine = (upcoming.data ?? []).filter(
    (a) =>
      a.professor.user_id === professor.user_id &&
      (a.status === 'pending' || a.status === 'approved'),
  );
  const college =
    language === 'ar' ? professor.department.college.name_ar : professor.department.college.name_en;

  const facts: [string, string][] = [
    [t('admin.department'), `${departmentName(professor.department, language)}, ${college}`],
    [t('admin.office'), professor.office ? officeFull(professor.office, t) : t('admin.no_office')],
    [t('admin.email'), professor.email],
    [t('admin.summary_length'), t('admin.summary_minutes', { minutes: professor.slot_minutes })],
    [
      t('admin.summary_messages'),
      t(professor.open_messages ? 'admin.summary_messages_open' : 'admin.summary_messages_booked'),
    ],
    [
      t('admin.summary_upcoming'),
      upcoming.data
        ? t('admin.summary_upcoming_value', {
            count: mine.length,
            waiting: mine.filter((a) => a.status === 'pending').length,
          })
        : '…',
    ],
  ];

  return (
    <BottomSheet visible title={name} onClose={onClose}>
      <View style={styles.head}>
        <Initials name={name} muted={!active} />
        <View style={styles.grow}>
          <Text weight="semibold">{`${t(`honorific.${professor.honorific}`)} ${name}`}</Text>
          <Text variant="caption" color="muted">
            {t(`rank.${professor.academic_rank}`)}
          </Text>
        </View>
        {active ? null : <Pill label={t('admin.deactivated')} />}
      </View>

      <View style={[styles.status, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        {!active ? (
          <Text color="muted">{t('admin.summary_hidden')}</Text>
        ) : detail.data ? (
          <StatusLabel
            status={detail.data.status.status}
            confirmed={detail.data.status.confirmed}
            updatedAt={
              detail.data.status.updated_at ? new Date(detail.data.status.updated_at) : null
            }
            withDoor
          />
        ) : (
          <SkeletonRow />
        )}
      </View>

      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} accessible accessibilityLabel={spokenList([label, value], t)}>
            <Text variant="caption" color="muted">
              {label}
            </Text>
            <Text>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {active ? null : (
          <Button
            label={t('admin.activate')}
            accessibilityLabel={t('admin.activate_label', { name })}
            onPress={() => activate(professor, name, onClose)}
            block
          />
        )}
        <Button
          variant={active ? 'primary' : 'secondary'}
          label={t('admin.summary_edit')}
          onPress={onEdit}
          block
        />
        <Button variant="quiet" label={t('common.close')} onPress={onClose} block />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  status: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    padding: space.sm,
    alignItems: 'flex-start',
  },
  facts: { gap: space.sm },
  actions: { gap: space.xs },
});
