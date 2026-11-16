/**
 * Student home, "Now" (DESIGN.md 7.2 and Section 11, "The corridor"): answers "who can I see
 * right now?" before a word is read.
 *
 * The corridor band: greeting, how many of the student's professors are in, and a tall door per
 * pinned professor (a lit door means in the office). Then search, the next appointment as a
 * ticket, and the student's department, in office first. Everything polls every 20 s. While
 * offline or when the server cannot be reached, the last known data stays on screen with a
 * notice and its time; a section with nothing to show says what happened and offers a retry.
 *
 * Phones and tablets: one column. Desktop: the band across the top beside the rail, the list
 * in the main column and the next appointment beside it.
 */
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColumn, useLayout } from '@/lib/layout';
import { isNetworkError } from '@/api/client';
import {
  useDepartmentProfessors,
  useNextAppointment,
  usePins,
  useProfessorSearch,
} from '@/api/queries';
import type { ProfessorSummary } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Band, Corridor, CorridorDoor } from '@/components/Corridor';
import { NotificationBell } from '@/components/NotificationBell';
import { SkeletonRow } from '@/components/Placeholders';
import { ProfessorRow } from '@/components/ProfessorRow';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import {
  ConnectionNotice,
  CorridorSkeleton,
  inOfficeNow,
  NextAppointmentCard,
  SectionError,
} from '@/features/home/HomeParts';
import { useStatusAnnouncement } from '@/features/home/useStatusAnnouncement';
import { usePinWithToast } from '@/features/professors/usePinWithToast';
import { errorKey } from '@/lib/errors';
import { greetingKey } from '@/lib/format';
import { useDebounced, useNow, useOnline } from '@/lib/hooks';
import { departmentName, firstName, professorShortName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space, type Language } from '@/theme/tokens';

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
  const column = useColumn();
  const desktop = useLayout() === 'desktop';
  const doorSize = desktop ? 92 : 72;
  const user = useUser();
  const now = useNow();
  const online = useOnline();
  const searchRef = useRef<TextInputInstance>(null);
  const [query, setQuery] = useState('');
  const searchText = useDebounced(query);
  const searching = query.trim().length > 0;

  const department = user.student?.department;
  const pins = usePins();
  const departmentList = useDepartmentProfessors(department?.department_id ?? 0, language);
  const next = useNextAppointment();
  const search = useProfessorSearch({ query: searchText }, language);
  const announcement = useStatusAnnouncement(pins.data);

  const togglePin = usePinWithToast();
  const openProfessor = (professor: ProfessorSummary) =>
    router.push(`/professors/${professor.professor_id}`);

  // The last known data stays visible offline, labelled with when it was fetched.
  const lastUpdated = Math.max(pins.dataUpdatedAt, departmentList.dataUpdatedAt);
  const unreachable = isNetworkError(pins.error) || isNetworkError(departmentList.error);
  const showNotice = (!online || unreachable) && lastUpdated > 0;
  const errorText = (error: unknown) => t(error ? errorKey(error) : 'errors.NETWORK');

  const pinsState = sectionState(pins, online);
  const departmentState = sectionState(departmentList, online);
  // An empty department (no professors in the app yet) is not the same as "nobody is in".
  const departmentEmpty = departmentList.data !== undefined && departmentList.data.length === 0;
  const nobodyIn =
    departmentList.data !== undefined &&
    !departmentEmpty &&
    !departmentList.data.some((p) => p.status.status === 'in_office');
  const rows = searching ? (search.data ?? []) : (departmentList.data ?? []);
  const answer = pins.data?.length ? inOfficeNow(pins.data, language) : null;

  const greeting = (
    <View style={desktop ? styles.greeting : undefined}>
      <Text variant="heading" role="heading" color="onBand">
        {t(greetingKey(now), { name: firstName(user, language) })}
      </Text>
      {answer ? <Text color="onBandMuted">{t(answer.key, { count: answer.count })}</Text> : null}
    </View>
  );

  // The student's pinned professors as doors; while they load, three outlines; with none
  // pinned, an invitation to search.
  const doors =
    pinsState === 'loading' ? (
      <CorridorSkeleton doorSize={doorSize} />
    ) : pinsState === 'error' ? (
      <SectionError onBand message={errorText(pins.error)} onRetry={() => pins.refetch()} />
    ) : pins.data?.length ? (
      <Corridor doorSize={doorSize} bleed={space.md}>
        {pins.data.map((professor) => (
          <CorridorDoor
            key={professor.professor_id}
            name={professorShortName(professor, language, t)}
            status={professor.status}
            now={now}
            doorSize={doorSize}
            onPress={() => openProfessor(professor)}
          />
        ))}
      </Corridor>
    ) : (
      <View style={styles.emptyPins}>
        <Text variant="title" color="onBand">
          {t('home.empty_pins_title')}
        </Text>
        <Text color="onBandMuted">{t('home.empty_pins_body')}</Text>
        <Button
          variant="onBand"
          label={t('home.empty_pins_action')}
          onPress={() => searchRef.current?.focus()}
        />
      </View>
    );

  const band = (
    <Band style={[styles.band, { paddingTop: insets.top + space.sm }]}>
      <View style={[styles.bandInner, desktop ? null : column]}>
        <AppBar onBand>
          <NotificationBell onBand />
        </AppBar>
        {desktop ? (
          <View style={styles.bandRow}>
            {greeting}
            <View style={styles.grow}>{doors}</View>
          </View>
        ) : (
          <>
            {greeting}
            {doors}
          </>
        )}
      </View>
    </Band>
  );

  const searchField = (
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
  );

  const ticket =
    !searching && next.data ? <NextAppointmentCard appointment={next.data} now={now} /> : null;

  const loadingRows =
    (searching && search.data === undefined) || (!searching && departmentState === 'loading');
  const list = (
    <View>
      {rows.map((professor) => (
        <ProfessorRow
          key={professor.professor_id}
          professor={professor}
          now={now}
          onPress={openProfessor}
          onTogglePin={togglePin}
          showDepartment={searching}
        />
      ))}
      {rows.length > 0 ? null : loadingRows ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : searching && !search.isFetching ? (
        <Text color="muted">{t('home.no_results', { query: query.trim() })}</Text>
      ) : null}
    </View>
  );

  const main = (
    <View style={styles.main}>
      {searchField}
      {showNotice ? <ConnectionNotice offline={!online} since={new Date(lastUpdated)} /> : null}
      {desktop ? null : ticket}
      {searching ? (
        <View style={styles.sectionHead}>
          <Text variant="title" role="heading" style={styles.grow}>
            {t('home.results')}
          </Text>
          <Button variant="quiet" label={t('home.clear_search')} onPress={() => setQuery('')} />
        </View>
      ) : (
        <>
          <View>
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
          {departmentState === 'error' ? (
            <SectionError
              message={errorText(departmentList.error)}
              onRetry={() => departmentList.refetch()}
            />
          ) : null}
          {nobodyIn ? <Text color="muted">{t('home.nobody_in')}</Text> : null}
          {departmentEmpty ? <Text color="muted">{t('home.department_empty')}</Text> : null}
        </>
      )}
      {list}

      {/* Status changes of pinned professors, read politely by screen readers on the web build. */}
      {Platform.OS === 'web' ? (
        <Text accessibilityLiveRegion="polite" style={styles.visuallyHidden}>
          {announcement}
        </Text>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {band}
      {desktop ? (
        <View style={styles.columns}>
          <View style={styles.desktopMain}>{main}</View>
          {ticket ? <View style={styles.aside}>{ticket}</View> : null}
        </View>
      ) : (
        <View style={[styles.body, column]}>{main}</View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: space.xl },
  band: { paddingHorizontal: space.md, paddingBottom: space.md },
  bandInner: { gap: space.sm },
  bandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  greeting: { width: 360, paddingTop: space.md },
  emptyPins: { gap: space.xs, alignItems: 'flex-start', paddingVertical: space.sm },
  body: { paddingHorizontal: space.md, paddingTop: space.md },
  main: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xl,
    padding: space.lg,
  },
  desktopMain: { flex: 1, maxWidth: layout.column },
  aside: { width: layout.listPane },
  visuallyHidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
