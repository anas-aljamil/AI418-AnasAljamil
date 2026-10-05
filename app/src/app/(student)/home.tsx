/**
 * Student home, "Now" (DESIGN.md 7.2): answers "who can I see right now?".
 *
 * Greeting, search, the next appointment, pinned professors (status visible with no taps),
 * then the student's department, in office first. Everything polls every 20 s. While offline
 * or when the server cannot be reached, the last known data stays on screen with a notice and
 * its time; a section with nothing to show says what happened and offers a retry.
 */
import { useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isNetworkError } from '@/api/client';
import {
  useDepartmentProfessors,
  useNextAppointment,
  usePins,
  usePinToggle,
  useProfessorSearch,
} from '@/api/queries';
import type { ProfessorSummary } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { ProfessorRow } from '@/components/ProfessorRow';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import {
  ConnectionNotice,
  NextAppointmentCard,
  PinnedCard,
  SectionError,
} from '@/features/home/HomeParts';
import { useStatusAnnouncement } from '@/features/home/useStatusAnnouncement';
import { errorKey } from '@/lib/errors';
import { greetingKey } from '@/lib/format';
import { useDebounced, useNow, useOnline } from '@/lib/hooks';
import { departmentName, firstName, professorName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

interface QueryLike {
  data?: unknown;
  error: unknown;
  fetchStatus: string;
}

/** What a section can show: its data, a loading skeleton, or why it has nothing. */
function sectionState(query: QueryLike, online: boolean): 'data' | 'loading' | 'error' {
  if (query.data !== undefined) return 'data';
  if (query.error || (!online && query.fetchStatus === 'paused')) return 'error';
  return 'loading';
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useUser();
  const now = useNow();
  const online = useOnline();
  const toast = useToast();
  const searchRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const searchText = useDebounced(query);
  const searching = query.trim().length > 0;

  const department = user.student?.department;
  const pins = usePins();
  const departmentList = useDepartmentProfessors(department?.department_id ?? 0, language);
  const next = useNextAppointment();
  const search = useProfessorSearch(searchText, language);
  const pinToggle = usePinToggle();
  const announcement = useStatusAnnouncement(pins.data);

  const togglePin = (professor: ProfessorSummary, pin: boolean) => {
    const name = professorName(professor, language, t);
    pinToggle.mutate(
      { professor, pin },
      {
        onSuccess: () => toast(t(pin ? 'home.pinned' : 'home.unpinned', { name })),
        onError: () => toast(t('home.pin_failed')),
      },
    );
  };

  // The last known data stays visible offline, labelled with when it was fetched.
  const lastUpdated = Math.max(pins.dataUpdatedAt, departmentList.dataUpdatedAt);
  const unreachable = isNetworkError(pins.error) || isNetworkError(departmentList.error);
  const showNotice = (!online || unreachable) && lastUpdated > 0;
  const errorText = (error: unknown) => t(error ? errorKey(error) : 'errors.NETWORK');

  const pinsState = sectionState(pins, online);
  const departmentState = sectionState(departmentList, online);
  const nobodyIn =
    departmentList.data !== undefined &&
    !departmentList.data.some((p) => p.status.status === 'in_office');
  const rows = searching ? (search.data ?? []) : (departmentList.data ?? []);

  const header = (
    <View style={styles.header}>
      <Text variant="heading" role="heading">
        {t(greetingKey(now), { name: firstName(user, language) })}
      </Text>
      <TextField
        ref={searchRef}
        label={t('home.search_label')}
        placeholder={t('home.search_placeholder')}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {showNotice ? <ConnectionNotice offline={!online} since={new Date(lastUpdated)} /> : null}

      {searching ? (
        <View style={styles.sectionHead}>
          <Text variant="title" role="heading" style={styles.grow}>
            {t('home.results')}
          </Text>
          <Button variant="quiet" label={t('home.clear_search')} onPress={() => setQuery('')} />
        </View>
      ) : (
        <>
          {next.data ? <NextAppointmentCard appointment={next.data} now={now} /> : null}

          <View style={styles.section}>
            <Text variant="title" role="heading">
              {t('home.my_professors')}
            </Text>
            {pinsState === 'loading' ? (
              <SkeletonRow />
            ) : pinsState === 'error' ? (
              <SectionError message={errorText(pins.error)} onRetry={() => pins.refetch()} />
            ) : pins.data?.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pinnedRow}
              >
                {pins.data.map((professor) => (
                  <PinnedCard key={professor.professor_id} professor={professor} now={now} />
                ))}
              </ScrollView>
            ) : (
              <EmptyState
                title={t('home.empty_pins_title')}
                body={t('home.empty_pins_body')}
                actionLabel={t('home.empty_pins_action')}
                onAction={() => searchRef.current?.focus()}
              />
            )}
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.grow}>
              <Text variant="title" role="heading">
                {t('home.available_now')}
              </Text>
              {department ? (
                <Text variant="caption" color="muted">
                  {t('home.department_caption', {
                    department: departmentName(department, language),
                  })}
                </Text>
              ) : null}
            </View>
          </View>
          {departmentState === 'error' ? (
            <SectionError
              message={errorText(departmentList.error)}
              onRetry={() => departmentList.refetch()}
            />
          ) : null}
          {nobodyIn ? <Text color="muted">{t('home.nobody_in')}</Text> : null}
        </>
      )}

      {/* Status changes of pinned professors, read politely by screen readers on the web build. */}
      {Platform.OS === 'web' ? (
        <Text accessibilityLiveRegion="polite" style={styles.visuallyHidden}>
          {announcement}
        </Text>
      ) : null}
    </View>
  );

  const loadingRows =
    (searching && search.data === undefined) || (!searching && departmentState === 'loading');
  const empty = loadingRows ? (
    <View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  ) : searching && !search.isFetching ? (
    <Text color="muted">{t('home.no_results', { query: query.trim() })}</Text>
  ) : null;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      data={rows}
      keyExtractor={(professor) => String(professor.professor_id)}
      renderItem={({ item }) => <ProfessorRow professor={item} now={now} onTogglePin={togglePin} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl },
  header: { gap: space.md, paddingBottom: space.xs },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  pinnedRow: { gap: space.sm },
  visuallyHidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
