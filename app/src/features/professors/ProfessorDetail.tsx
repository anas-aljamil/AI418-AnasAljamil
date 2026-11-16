/**
 * Professor profile (DESIGN.md 7.4 and Section 11, "The corridor"): the professor's door on
 * the band, tall, with the name, the status as a sentence ("In office until 12:00 PM"), rank,
 * department and office. Under it: when the status was last set, the note, today as a ribbon
 * and as an agenda, the booking times, and Book (primary), Message and Pin. Book is off when
 * the professor has no booking times; Message always opens the conversation, and while the
 * professor's closed hours are on the profile and the conversation say when messages open again.
 *
 * Phones and tablets: a full screen with a back button and the actions in a sticky bar within
 * thumb reach. Desktop: the actions sit in a row under the band, and in a pane (Search,
 * docs/desktop-plan.md) there is no back button, because the list stays beside it.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Pin from 'lucide-react-native/icons/pin';

import { useColumn, useLayout } from '@/lib/layout';
import { useOpenConversation, useProfessor } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Band } from '@/components/Corridor';
import { DayRibbon } from '@/components/DayRibbon';
import { SkeletonRow } from '@/components/Placeholders';
import { describeStatus, statusSentence } from '@/components/StatusLabel';
import { IconButton } from '@/components/Surfaces';
import { TallDoor } from '@/components/TallDoor';
import { Text } from '@/components/Text';
import { TodayTimeline } from '@/components/TodayTimeline';
import { useToast } from '@/components/Toast';
import { BookingSheet } from '@/features/booking/BookingSheet';
import { SectionError } from '@/features/home/HomeParts';
import { usePinWithToast } from '@/features/professors/usePinWithToast';
import { errorKey } from '@/lib/errors';
import { dateText, shortDateText } from '@/lib/dates';
import { clockText, laterText } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { departmentName, officeFull, professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, touchTarget, type Language } from '@/theme/tokens';

interface ProfessorDetailProps {
  professorId: number;
  /** Shown in a pane beside a list (desktop Search): no back button, no column of its own. */
  pane?: boolean;
}

export function ProfessorDetail({ professorId, pane = false }: ProfessorDetailProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn();
  const inline = useLayout() === 'desktop';
  const now = useNow();
  const { state } = useAuth();
  const isStudent = state.status === 'signedIn' && state.user.role === 'student';
  const professor = useProfessor(professorId);
  const togglePin = usePinWithToast();
  const toast = useToast();
  const [booking, setBooking] = useState(false);

  const openChat = useOpenConversation();
  const message = () => {
    if (!data) return;
    openChat.mutate(
      { professor_id: data.professor_id },
      {
        onSuccess: (conversation) => router.push(`/conversations/${conversation.conversation_id}`),
        onError: (error) => toast(t(errorKey(error))),
      },
    );
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Directional icons mirror in right-to-left layouts (DESIGN.md Section 9). On native the
  // Icons are drawings: layout direction moves them but never mirrors them, so the back
  // arrow is flipped for Arabic on every platform.
  const flip = language === 'ar';

  const data = professor.data;
  const status = data ? statusSentence(data.status, now, language, t) : null;
  // "updated 3 min ago" or "from the schedule". A not-confirmed status already says its age
  // in the sentence on the band.
  const updated =
    data && status && status.door !== 'unknown'
      ? describeStatus(
          data.status.status,
          data.status.confirmed,
          data.status.updated_at ? new Date(data.status.updated_at) : null,
          now,
          language,
          t,
        ).updated
      : null;
  const name = data ? professorName(data, language, t) : '';
  const closedUntil =
    data?.messages_closed_until && new Date(data.messages_closed_until) > now
      ? new Date(data.messages_closed_until)
      : null;
  const bookable = !!data && data.booking_periods.length > 0;

  const actions =
    data && isStudent ? (
      <>
        <View style={inline ? undefined : styles.grow}>
          <Button
            label={t('prof.book')}
            onPress={() => setBooking(true)}
            disabled={!bookable}
            block={!inline}
          />
        </View>
        <Button
          variant="secondary"
          label={t('chat.message')}
          accessibilityLabel={t('chat.message_label', { name })}
          disabled={openChat.isPending}
          onPress={message}
        />
        <IconButton
          label={t(data.is_pinned ? 'home.unpin' : 'home.pin', { name })}
          selected={!!data.is_pinned}
          onPress={() => togglePin(data, !data.is_pinned)}
          icon={
            <Pin
              color={data.is_pinned ? colors.primary : colors.muted}
              fill={data.is_pinned ? colors.primary : 'none'}
              size={22}
              strokeWidth={1.75}
            />
          }
        />
        <BookingSheet professor={data} visible={booking} onClose={() => setBooking(false)} />
      </>
    ) : null;

  // In a pane the band has no back button, so it only appears once there is a door to show.
  const band =
    pane && !(data && status) ? null : (
      <Band style={[styles.band, pane ? styles.bandPane : { paddingTop: insets.top + space.xs }]}>
        <View style={[styles.bandInner, pane ? null : column]}>
          {pane ? null : (
            <View style={styles.topBar}>
              <IconButton
                label={t('prof.back')}
                onPress={back}
                icon={
                  <View style={flip ? styles.flipped : undefined}>
                    <ChevronLeft color={colors.onBand} size={26} strokeWidth={1.75} />
                  </View>
                }
              />
            </View>
          )}
          {data && status ? (
            <View style={styles.hero}>
              <TallDoor
                status={status.door}
                size={inline ? 104 : 88}
                onBand
                accessibilityLabel={t('status.door', { status: status.label })}
              />
              <View style={styles.heroText}>
                <Text variant="heading" role="heading" color="onBand">
                  {name}
                </Text>
                <View accessibilityLiveRegion="polite">
                  <Text weight="semibold" style={{ color: colors.bandStatusText[status.door] }}>
                    {status.label}
                  </Text>
                  {status.when ? <Text color="onBandMuted">{status.when}</Text> : null}
                </View>
                <Text variant="caption" color="onBandMuted">
                  {spokenList(
                    [t(`rank.${data.academic_rank}`), departmentName(data.department, language)],
                    t,
                  )}
                </Text>
                <Text variant="caption" color="onBandMuted">
                  {officeFull(data.office, t)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Band>
    );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {band}
        <View style={[styles.page, pane ? styles.panePage : column]}>
          {data && status ? (
            <>
              {inline && actions ? <View style={styles.actionRow}>{actions}</View> : null}

              {updated || data.status.note || closedUntil ? (
                <View style={styles.section}>
                  {updated ? <Text color="muted">{updated}</Text> : null}
                  {data.status.note ? (
                    <Text>{t('prof.note', { note: data.status.note })}</Text>
                  ) : null}
                  {closedUntil ? (
                    <Text color="muted">
                      {t('prof.messages_closed', { time: laterText(closedUntil, now, t) })}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.section}>
                <Text variant="title" role="heading">
                  {t('prof.today')}
                </Text>
                {data.today.blocks.length > 0 ? (
                  <DayRibbon blocks={data.today.blocks} now={data.today.now_local_time} />
                ) : null}
                <TodayTimeline blocks={data.today.blocks} now={data.today.now_local_time} />
              </View>

              <View style={styles.section}>
                <Text variant="title" role="heading">
                  {t('prof.booking_times')}
                </Text>
                {bookable ? (
                  // Weekly times by their day (with a last date when they end); a dated one by
                  // its date, from today on (2026-11-11).
                  data.booking_periods
                    .filter((period) => !period.on_date || period.on_date >= data.today.date)
                    .map((period) => (
                      <Text key={period.period_id}>
                        {t('prof.period_line', {
                          day: period.on_date
                            ? dateText(period.on_date, t)
                            : t(`weekday.${period.day_of_week}`),
                          start: clockText(period.start_time, t),
                          end: clockText(period.end_time, t),
                        }) +
                          (period.ends_on
                            ? t('prof.period_until', { date: shortDateText(period.ends_on, t) })
                            : '')}
                      </Text>
                    ))
                ) : (
                  <Text color="muted">{t('prof.no_booking_times', { name })}</Text>
                )}
              </View>
            </>
          ) : professor.error ? (
            <View style={styles.section}>
              <Text variant="title">{t('prof.load_failed')}</Text>
              <SectionError
                message={t(errorKey(professor.error))}
                onRetry={() => professor.refetch()}
              />
            </View>
          ) : (
            <View>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          )}
        </View>
      </ScrollView>

      {!inline && actions ? (
        <View
          style={[
            styles.bar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.line,
              paddingBottom: insets.bottom + space.sm,
            },
          ]}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingBottom: space.xl },
  band: { paddingHorizontal: space.md, paddingBottom: space.md },
  bandPane: { paddingTop: space.lg, paddingHorizontal: space.lg },
  bandInner: { gap: space.xs },
  topBar: { flexDirection: 'row', marginStart: -space.sm },
  flipped: { transform: [{ scaleX: -1 }] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroText: { flex: 1, gap: space.xxs },
  page: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.lg },
  panePage: { paddingHorizontal: space.lg },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  section: { gap: space.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget + space.lg,
  },
  grow: { flex: 1 },
});
