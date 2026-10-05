/** The pieces of the student home screen (DESIGN.md 7.2, design plan Direction A). */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CloudOff from 'lucide-react-native/icons/cloud-off';

import type { Appointment, ProfessorSummary } from '@/api/types';
import { Button } from '@/components/Button';
import { Door } from '@/components/Door';
import { describeStatus } from '@/components/StatusLabel';
import { Card, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { appointmentDay, countdownKey, riyadhTime } from '@/lib/format';
import { officeText, professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, type Language } from '@/theme/tokens';

function useLanguage(): Language {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar' : 'en';
}

/** A pinned professor as a small nameplate card in the sideways "My professors" row. */
export function PinnedCard({ professor, now }: { professor: ProfessorSummary; now: Date }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const name = professorName(professor, language, t);
  const { door, label, updated } = describeStatus(
    professor.status.status,
    professor.status.confirmed,
    professor.status.updated_at ? new Date(professor.status.updated_at) : null,
    now,
    language,
    t,
  );
  return (
    <Card
      style={styles.pinned}
      accessible
      accessibilityLabel={spokenList([name, label, updated], t)}
    >
      <Door status={door} size={40} />
      <Text variant="label" weight="semibold" numberOfLines={2}>
        {name}
      </Text>
      <Text variant="label">{label}</Text>
      <Text variant="caption" color="muted">
        {updated}
      </Text>
    </Card>
  );
}

/** The soonest pending or approved appointment, with a countdown. */
export function NextAppointmentCard({ appointment, now }: { appointment: Appointment; now: Date }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const start = new Date(appointment.starts_at);
  const day = appointmentDay(start, now);
  const when = t(day.key, { time: day.time, day: t(`weekday.${day.weekday}`) });
  const countdown = countdownKey(language, start, now);
  const approved = appointment.status === 'approved';
  const state = t(approved ? 'home.appointment_approved' : 'home.appointment_pending');
  const name = professorName(appointment.professor, language, t);
  const timing = t('home.when_countdown', {
    when,
    countdown: t(countdown.key, { count: countdown.count }),
  });
  const office = officeText(appointment.professor.office, t);
  return (
    <Card
      accessible
      accessibilityLabel={`${t('home.next_appointment')}: ${spokenList([name, timing, office, state], t)}`}
    >
      <View style={styles.cardTop}>
        <Text variant="caption" color="muted" style={styles.grow}>
          {t('home.next_appointment')}
        </Text>
        <Pill label={state} tone={approved ? 'primary' : 'muted'} />
      </View>
      <Text variant="body" weight="semibold">
        {name}
      </Text>
      <Text>{timing}</Text>
      <Text color="muted">{office}</Text>
    </Card>
  );
}

/** Shown while offline or when the server cannot be reached, with the time of the shown data. */
export function ConnectionNotice({ offline, since }: { offline: boolean; since: Date }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const message = t(offline ? 'home.offline' : 'home.unreachable', { time: riyadhTime(since) });
  return (
    <View
      style={[styles.notice, { borderColor: colors.line, backgroundColor: colors.surface }]}
      accessibilityLiveRegion="polite"
      role="status"
    >
      <CloudOff color={colors.muted} size={20} strokeWidth={1.75} />
      <Text variant="label" style={styles.grow}>
        {message}
      </Text>
    </View>
  );
}

/** A section that could not load and has nothing to show yet: what happened, and a retry. */
export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionError} accessibilityLiveRegion="polite">
      <Text color="muted">{message}</Text>
      <Button variant="secondary" label={t('home.try_again')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  pinned: { width: 176, gap: space.xxs },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.input,
    padding: space.sm,
  },
  sectionError: { gap: space.xs, alignItems: 'flex-start' },
});
