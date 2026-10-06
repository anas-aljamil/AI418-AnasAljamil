/**
 * Professor profile (DESIGN.md 7.4): a nameplate header (door, name, rank, department,
 * office), the live status with its note, return time and "updated" time, today's timeline,
 * and a sticky bar with Book (primary) and Pin within thumb reach. Message joins in P5.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Pin from 'lucide-react-native/icons/pin';

import { useOpenConversation, useProfessor } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Door } from '@/components/Door';
import { SkeletonRow } from '@/components/Placeholders';
import { describeStatus } from '@/components/StatusLabel';
import { IconButton } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TodayTimeline } from '@/components/TodayTimeline';
import { useToast } from '@/components/Toast';
import { BookingSheet } from '@/features/booking/BookingSheet';
import { SectionError } from '@/features/home/HomeParts';
import { usePinWithToast } from '@/features/professors/usePinWithToast';
import { errorKey } from '@/lib/errors';
import { untilText } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { departmentName, officeFull, professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget, type Language } from '@/theme/tokens';

export default function ProfessorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const professorId = Number(id) || 0;
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { state } = useAuth();
  const isStudent = state.status === 'signedIn' && state.user.role === 'student';
  const professor = useProfessor(professorId);
  const togglePin = usePinWithToast();
  const toast = useToast();
  const [booking, setBooking] = useState(false);

  const openChat = useOpenConversation();
  // The chat rule is checked by the API; when it says no, tapping explains why.
  const message = () => {
    if (!data) return;
    if (!data.can_message) {
      toast(t('chat.not_allowed', { name }));
      return;
    }
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
  const status = data
    ? describeStatus(
        data.status.status,
        data.status.confirmed,
        data.status.updated_at ? new Date(data.status.updated_at) : null,
        now,
        language,
        t,
      )
    : null;
  const name = data ? professorName(data, language, t) : '';

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}>
        <View style={styles.topBar}>
          <IconButton
            label={t('prof.back')}
            onPress={back}
            icon={
              <View style={flip ? styles.flipped : undefined}>
                <ChevronLeft color={colors.text} size={26} strokeWidth={1.75} />
              </View>
            }
          />
        </View>

        {data && status ? (
          <>
            {/* The nameplate beside the office door. */}
            <View
              style={[
                styles.nameplate,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <Door
                status={status.door}
                size={72}
                accessibilityLabel={t('status.door', { status: status.label })}
              />
              <View style={styles.plateText}>
                <Text variant="heading" role="heading">
                  {name}
                </Text>
                <Text color="muted">
                  {spokenList(
                    [t(`rank.${data.academic_rank}`), departmentName(data.department, language)],
                    t,
                  )}
                </Text>
                <Text color="muted">{officeFull(data.office, t)}</Text>
              </View>
            </View>

            <View style={styles.section} accessibilityLiveRegion="polite">
              <Text variant="title">{status.label}</Text>
              <Text color="muted">
                {data.status.until
                  ? spokenList([status.updated, untilText(new Date(data.status.until), t)], t)
                  : status.updated}
              </Text>
              {data.status.note ? <Text>{t('prof.note', { note: data.status.note })}</Text> : null}
            </View>

            <View style={styles.section}>
              <Text variant="title" role="heading">
                {t('prof.today')}
              </Text>
              <TodayTimeline blocks={data.today.blocks} now={data.today.now_local_time} />
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
      </ScrollView>

      {data && isStudent ? (
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
          <View style={styles.grow}>
            <Button label={t('prof.book')} onPress={() => setBooking(true)} block />
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  topBar: { flexDirection: 'row', marginStart: -space.sm },
  flipped: { transform: [{ scaleX: -1 }] },
  nameplate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radii.sheet,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plateText: { flex: 1, gap: space.xxs },
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
