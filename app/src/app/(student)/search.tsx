/**
 * Search and browse (DESIGN.md 7.3): Arabic-aware search by name or department, with filter
 * chips for status and office hours today and a department menu grouped by college. Results
 * are flat rows, in office first; a row opens the professor's profile (one tap) and has its
 * own pin button.
 */
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDepartments, useProfessorSearch } from '@/api/queries';
import type { ProfessorSummary } from '@/api/types';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DepartmentPicker } from '@/components/DepartmentPicker';
import { SkeletonRow } from '@/components/Placeholders';
import { ProfessorRow } from '@/components/ProfessorRow';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { SectionError } from '@/features/home/HomeParts';
import { usePinWithToast } from '@/features/professors/usePinWithToast';
import { errorKey } from '@/lib/errors';
import { useDebounced, useNow } from '@/lib/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

const STATUSES = ['in_office', 'in_class', 'busy', 'away'] as const;

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const togglePin = usePinWithToast();
  const departments = useDepartments();

  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [officeHoursToday, setOfficeHoursToday] = useState(false);
  const searchText = useDebounced(query);
  const active =
    query.trim().length > 0 || statuses.length > 0 || departmentIds.length > 0 || officeHoursToday;
  const results = useProfessorSearch(
    { query: searchText, statuses, departmentIds, officeHoursToday },
    language,
  );

  const clear = () => {
    setQuery('');
    setStatuses([]);
    setDepartmentIds([]);
    setOfficeHoursToday(false);
  };
  const open = (professor: ProfessorSummary) =>
    router.push(`/professors/${professor.professor_id}`);

  const header = (
    <View style={styles.header}>
      <Text variant="heading" role="heading">
        {t('search.title')}
      </Text>
      <TextField
        label={t('home.search_label')}
        placeholder={t('home.search_placeholder')}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      <View style={styles.group}>
        <Text variant="label" role="heading">
          {t('search.status_filter')}
        </Text>
        <View style={styles.chips}>
          {STATUSES.map((status) => (
            <Chip
              key={status}
              label={t(`status.${status}`)}
              selected={statuses.includes(status)}
              onPress={() => setStatuses((current) => toggle(current, status))}
            />
          ))}
          <Chip
            label={t('search.office_hours_today')}
            selected={officeHoursToday}
            onPress={() => setOfficeHoursToday((on) => !on)}
          />
        </View>
      </View>
      <DepartmentPicker
        label={t('search.department_filter')}
        departments={departments.data ?? []}
        value={departmentIds[0] ?? null}
        onChange={(id) => setDepartmentIds(id === null ? [] : [id])}
        allLabel={t('department_picker.all')}
        loading={departments.isPending}
        loadError={departments.error ? t(errorKey(departments.error)) : undefined}
        onRetry={() => departments.refetch()}
      />
      {active ? (
        <View style={styles.clear}>
          <Button variant="quiet" label={t('search.clear')} onPress={clear} />
        </View>
      ) : null}
    </View>
  );

  const empty = !active ? (
    <Text color="muted">{t('search.prompt')}</Text>
  ) : results.error && !results.data ? (
    <SectionError message={t(errorKey(results.error))} onRetry={() => results.refetch()} />
  ) : results.data === undefined || (results.isPlaceholderData && results.isFetching) ? (
    <View>
      <SkeletonRow />
      <SkeletonRow />
    </View>
  ) : (
    <Text color="muted">
      {query.trim() ? t('home.no_results', { query: query.trim() }) : t('search.no_match')}
    </Text>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      data={active ? (results.data ?? []) : []}
      keyExtractor={(professor) => String(professor.professor_id)}
      renderItem={({ item }) => (
        <ProfessorRow professor={item} now={now} onPress={open} onTogglePin={togglePin} />
      )}
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
  group: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  row: { flexDirection: 'row', gap: space.xs },
  clear: { alignItems: 'flex-start' },
});
