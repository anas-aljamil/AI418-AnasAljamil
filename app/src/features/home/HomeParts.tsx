/** The pieces of the student home screen (DESIGN.md 7.2 and Section 11, "The corridor"). */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CloudOff from 'lucide-react-native/icons/cloud-off';

import type { Appointment, ProfessorSummary } from '@/api/types';
import { Button } from '@/components/Button';
import { TallDoor } from '@/components/TallDoor';
import { Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { appointmentDay, clockText, countdownKey, pluralCategory, riyadhTime } from '@/lib/format';
import { officeText, professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, type Language } from '@/theme/tokens';

function useLanguage(): Language {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar' : 'en';
}

/**
 * The answer in words, above the corridor: how many of the student's professors are in their
 * offices now, as an i18n key and its count. Only confirmed "in office" counts, the same doors
 * that are lit.
 */
export function inOfficeNow(
  pins: ProfessorSummary[],
  language: Language,
): { key: string; count: number } {
  const count = pins.filter((p) => p.status.status === 'in_office' && p.status.confirmed).length;
  const key = count === 0 ? 'home.in_now_none' : `home.in_now_${pluralCategory(language, count)}`;
  return { key, count };
}

const NOTCH = 14;

/**
 * The soonest pending or approved appointment as a ticket: the time large at the start edge,
 * a dashed fold, then the professor, the room and whether it is approved.
 */
export function NextAppointmentCard({ appointment, now }: { appointment: Appointment; now: Date }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useLanguage();
  const start = new Date(appointment.starts_at);
  const day = appointmentDay(start, now);
  const time = clockText(day.time, t);
  const when = t(day.key, { time, day: t(`weekday.${day.weekday}`) });
  const countdown = countdownKey(language, start, now);
  const countdownText = t(countdown.key, { count: countdown.count });
  const approved = appointment.status === 'approved';
  const state = t(approved ? 'home.appointment_approved' : 'home.appointment_pending');
  const name = professorName(appointment.professor, language, t);
  const office = officeText(appointment.professor.office, t);
  const notch = { backgroundColor: colors.bg, borderColor: colors.line };
  return (
    <View
      accessible
      accessibilityLabel={`${t('home.next_appointment')}: ${spokenList(
        [name, t('home.when_countdown', { when, countdown: countdownText }), office, state],
        t,
      )}`}
      style={[styles.ticket, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <View style={styles.ticketWhen}>
        <Text variant="title" weight="bold">
          {time}
        </Text>
        <Text variant="caption" color="muted">
          {t(`weekday.${day.weekday}`)}
        </Text>
        <Text variant="caption" color="muted">
          {countdownText}
        </Text>
      </View>
      <View style={styles.fold}>
        <View style={[styles.notch, styles.notchTop, notch]} />
        <View style={[styles.foldLine, { borderColor: colors.line }]} />
        <View style={[styles.notch, styles.notchBottom, notch]} />
      </View>
      <View style={styles.ticketWhat}>
        <Text variant="caption" color="muted">
          {t('home.next_appointment')}
        </Text>
        <Text variant="body" weight="semibold">
          {name}
        </Text>
        <Text variant="label" color="muted">
          {office}
        </Text>
        <Pill label={state} tone={approved ? 'primary' : 'muted'} />
      </View>
    </View>
  );
}

/** The corridor while the pinned professors load: three dim outlines. */
export function CorridorSkeleton({ doorSize }: { doorSize: number }) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('common.loading')} aria-busy style={styles.skeleton}>
      {[0, 1, 2].map((i) => (
        <TallDoor key={i} status="unknown" size={doorSize} onBand floor={false} />
      ))}
    </View>
  );
}

/** Shown while offline or when the server cannot be reached, with the time of the shown data. */
export function ConnectionNotice({ offline, since }: { offline: boolean; since: Date }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const message = t(offline ? 'home.offline' : 'home.unreachable', {
    time: clockText(riyadhTime(since), t),
  });
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

interface SectionErrorProps {
  message: string;
  onRetry: () => void;
  /** On the corridor band: band colours. */
  onBand?: boolean;
}

/** A section that could not load and has nothing to show yet: what happened, and a retry. */
export function SectionError({ message, onRetry, onBand = false }: SectionErrorProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionError} accessibilityLiveRegion="polite">
      <Text color={onBand ? 'onBandMuted' : 'muted'}>{message}</Text>
      <Button
        variant={onBand ? 'onBand' : 'secondary'}
        label={t('home.try_again')}
        onPress={onRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  ticketWhen: { padding: space.md, justifyContent: 'center', gap: 2 },
  ticketWhat: { flex: 1, padding: space.md, gap: space.xxs },
  fold: { width: NOTCH, alignItems: 'center' },
  foldLine: { flex: 1, borderStartWidth: 1.5, borderStyle: 'dashed', marginVertical: NOTCH / 2 },
  notch: {
    position: 'absolute',
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  skeleton: { flexDirection: 'row', gap: space.xl, opacity: 0.45 },
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
