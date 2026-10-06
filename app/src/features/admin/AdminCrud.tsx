/**
 * Admin CRUD on the phone (CLAUDE.md Section 3; DESIGN.md Section 11, product focus): one list
 * screen per table with a count, search, filter chips for accounts (All, Active, Not active),
 * optional grouping (departments by college), and a form sheet for create and edit. Each row
 * leads with initials (people) or an icon. The form is split into sections (Account, Academic,
 * Status); field rules mirror the API, so errors show next to the field before saving; the
 * API's own answer (a duplicate code or email, a department still in use) is shown above
 * Save. Deleting sits apart at the bottom and always asks first. A table may show a summary
 * first (professors), with Edit inside it.
 */
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Plus from 'lucide-react-native/icons/plus';

import { useAdminList, useAdminSave, type AdminResource, type AdminRows } from '@/api/queries';
import type { Department } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { DepartmentPicker } from '@/components/DepartmentPicker';
import { MenuPicker } from '@/components/MenuPicker';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { ListRow, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { FormSection, IconSquare, Initials, SwitchRow, type IconComponent } from './parts';

export type FormValues = Record<string, string>;
export type FormSectionKey = 'details' | 'account' | 'academic' | 'status';
const SECTION_ORDER: FormSectionKey[] = ['details', 'account', 'academic', 'status'];

interface BaseField {
  key: string;
  label: string;
  /** Only when creating (password) or only when editing (active). */
  only?: 'create' | 'edit';
  /** The part of the form it belongs to (default: details). */
  section?: FormSectionKey;
}

export interface TextFieldSpec extends BaseField {
  type: 'text';
  /** i18n key of the problem, or null when the value is fine. */
  validate?: (value: string, editing: boolean) => string | null;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'number-pad';
  upper?: boolean;
  maxLength?: number;
}

export interface ChoiceFieldSpec extends BaseField {
  type: 'choice';
  options: { value: string; label: string }[];
  /** No default: the admin must pick one (e.g. a department's college). */
  required?: boolean;
}

/** One of a longer list, chosen in a sheet (offices). */
export interface MenuFieldSpec extends BaseField {
  type: 'menu';
  options: { value: string; label: string }[];
  placeholder: string;
}

/** On or off ("true" / "false"), with a hint that says what it means. */
export interface SwitchFieldSpec extends BaseField {
  type: 'switch';
  hint?: string;
}

/** A department, chosen from the menu grouped by college. */
export interface DepartmentFieldSpec extends BaseField {
  type: 'department';
  departments: Department[];
}

export type FieldSpec =
  TextFieldSpec | ChoiceFieldSpec | MenuFieldSpec | SwitchFieldSpec | DepartmentFieldSpec;

export interface AdminConfig<R extends AdminResource> {
  resource: R;
  title: string;
  /** What the search looks in ("Search by name or email"). */
  searchLabel: string;
  idOf: (row: AdminRows[R]) => number;
  titleOf: (row: AdminRows[R]) => string;
  subtitleOf?: (row: AdminRows[R]) => string;
  /** People show their initials; departments and offices an icon. */
  leading: { kind: 'person' } | { kind: 'icon'; icon: IconComponent };
  /** Accounts can be filtered by it, and say "Not active". */
  inactive?: (row: AdminRows[R]) => boolean;
  /** Rows under headings (departments by college), sorted by heading. */
  groupOf?: (row: AdminRows[R]) => { key: string; title: string };
  fields: FieldSpec[];
  /** Form values for a row (edit) or the defaults (create). */
  valuesOf: (row: AdminRows[R] | null) => FormValues;
  /** The request body; on edit an empty password is left out. */
  bodyOf: (values: FormValues, editing: boolean) => Record<string, unknown>;
  /** People get the stronger warning (their appointments and messages go too). */
  person?: boolean;
}

type Filter = 'all' | 'active' | 'inactive';

export function required(value: string) {
  return value.trim() ? null : 'admin.required';
}

interface AdminCrudScreenProps<R extends AdminResource> {
  config: AdminConfig<R>;
  /** Above the title (Campus: the Departments / Offices switch). */
  top?: React.ReactNode;
  /** Open the empty form at once (from the overview's quick actions). */
  addRequested?: boolean;
  onAddClosed?: () => void;
  /** Shown first when a row is tapped; `edit` opens the form. */
  renderSummary?: (
    row: AdminRows[R],
    actions: { edit: () => void; close: () => void },
  ) => React.ReactNode;
}

export function AdminCrudScreen<R extends AdminResource>({
  config,
  top,
  addRequested,
  onAddClosed,
  renderSummary,
}: AdminCrudScreenProps<R>) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const list = useAdminList(config.resource);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<{ row: AdminRows[R] | null } | null>(null);
  const [summary, setSummary] = useState<AdminRows[R] | null>(null);
  const formRow = editing ?? (addRequested ? { row: null } : null);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((row) => {
      if (config.inactive && filter !== 'all' && config.inactive(row) !== (filter === 'inactive')) {
        return false;
      }
      return (
        !q || `${config.titleOf(row)} ${config.subtitleOf?.(row) ?? ''}`.toLowerCase().includes(q)
      );
    });
  }, [all, query, filter, config]);

  const sections = useMemo(() => {
    if (!config.groupOf) return rows.length ? [{ key: 'all', title: '', data: rows }] : [];
    const groups = new Map<string, { key: string; title: string; data: AdminRows[R][] }>();
    for (const row of rows) {
      const group = config.groupOf(row);
      const entry = groups.get(group.key) ?? { ...group, data: [] };
      entry.data.push(row);
      groups.set(group.key, entry);
    }
    return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, language));
  }, [rows, config, language]);

  const inactiveCount = config.inactive ? all.filter((row) => config.inactive!(row)).length : 0;
  const closeForm = () => {
    setEditing(null);
    if (addRequested) onAddClosed?.();
  };

  const header = (
    <View style={styles.header}>
      {top}
      <View style={styles.titleRow}>
        <View style={styles.grow}>
          <Text variant="heading" role="heading">
            {config.title}
          </Text>
          {list.data ? (
            <Text variant="caption" color="muted">
              {config.inactive
                ? t('admin.count_accounts', { count: all.length, inactive: inactiveCount })
                : t('admin.count', { count: all.length })}
            </Text>
          ) : null}
        </View>
        <Button
          label={t('admin.add')}
          icon={<Plus color={colors.onPrimary} size={18} strokeWidth={2.25} />}
          onPress={() => setEditing({ row: null })}
        />
      </View>
      <TextField
        label={config.searchLabel}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {config.inactive ? (
        <View style={styles.chips}>
          {(['all', 'active', 'inactive'] as const).map((option) => (
            <Chip
              key={option}
              label={t(`admin.filter_${option}`)}
              selected={filter === option}
              onPress={() => setFilter(option)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <SectionList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
        sections={sections}
        keyExtractor={(row) => String(config.idOf(row))}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={styles.sectionHead}>
              <Text variant="label" weight="semibold" role="heading" style={styles.grow}>
                {section.title}
              </Text>
              <Text variant="caption" color="muted">
                {t('admin.count', { count: section.data.length })}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const off = config.inactive?.(item) ?? false;
          const title = config.titleOf(item);
          const subtitle = config.subtitleOf?.(item);
          return (
            <ListRow
              leading={
                config.leading.kind === 'person' ? (
                  <Initials name={title} muted={off} />
                ) : (
                  <IconSquare icon={config.leading.icon} />
                )
              }
              title={title}
              subtitle={subtitle}
              trailing={off ? <Pill label={t('admin.deactivated')} /> : null}
              accessibilityLabel={spokenList(
                [title, subtitle, off ? t('admin.deactivated') : null],
                t,
              )}
              onPress={() => (renderSummary ? setSummary(item) : setEditing({ row: item }))}
            />
          );
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          list.data === undefined && !list.error ? (
            <View>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : list.error ? (
            <SectionError message={t(errorKey(list.error))} onRetry={() => list.refetch()} />
          ) : (
            <EmptyState title={t(all.length ? 'admin.no_match' : 'admin.empty')} />
          )
        }
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      />
      {summary && renderSummary
        ? renderSummary(summary, {
            edit: () => {
              setEditing({ row: summary });
              setSummary(null);
            },
            close: () => setSummary(null),
          })
        : null}
      {formRow ? (
        <AdminForm
          key={formRow.row ? config.idOf(formRow.row) : 'new'}
          config={config}
          row={formRow.row}
          onClose={closeForm}
        />
      ) : null}
    </>
  );
}

function AdminForm<R extends AdminResource>({
  config,
  row,
  onClose,
}: {
  config: AdminConfig<R>;
  row: AdminRows[R] | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useAdminSave(config.resource);
  const editing = row !== null;
  const [values, setValues] = useState<FormValues>(() => config.valuesOf(row));
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fields = config.fields.filter((f) => !f.only || f.only === (editing ? 'edit' : 'create'));
  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const errors = Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.type === 'text' && field.validate
        ? field.validate(values[field.key] ?? '', editing)
        : field.type === 'department' || (field.type === 'choice' && field.required)
          ? required(values[field.key] ?? '')
          : null,
    ]),
  );
  const valid = Object.values(errors).every((e) => e === null);
  const errorOf = (field: FieldSpec) =>
    showErrors && errors[field.key] ? t(errors[field.key]!) : undefined;

  const submit = () => {
    setShowErrors(true);
    if (!valid) return;
    setServerError(null);
    save.mutate(
      { id: row ? config.idOf(row) : null, body: config.bodyOf(values, editing) },
      {
        onSuccess: () => {
          toast(t('admin.saved'));
          onClose();
        },
        onError: (error) => setServerError(t(errorKey(error))),
      },
    );
  };

  const remove = () => {
    if (!row) return;
    save.mutate(
      { id: config.idOf(row), body: null },
      {
        onSuccess: () => {
          toast(t('admin.deleted'));
          onClose();
        },
        onError: (error) => {
          setConfirming(false);
          setServerError(t(errorKey(error)));
        },
      },
    );
  };

  const renderField = (field: FieldSpec) => {
    const value = values[field.key] ?? '';
    switch (field.type) {
      case 'text':
        return (
          <TextField
            key={field.key}
            label={field.label}
            value={value}
            onChangeText={(text) => set(field.key, field.upper ? text.toUpperCase() : text)}
            error={errorOf(field)}
            secureTextEntry={field.secure}
            keyboardType={field.keyboard ?? 'default'}
            autoCapitalize={field.upper ? 'characters' : 'none'}
            autoCorrect={false}
            maxLength={field.maxLength}
          />
        );
      case 'department':
        return (
          <DepartmentPicker
            key={field.key}
            label={field.label}
            departments={field.departments}
            value={value ? Number(value) : null}
            onChange={(id) => set(field.key, id === null ? '' : String(id))}
            error={errorOf(field)}
          />
        );
      case 'menu':
        return (
          <MenuPicker
            key={field.key}
            label={field.label}
            options={field.options}
            value={value}
            onChange={(option) => set(field.key, option)}
            placeholder={field.placeholder}
          />
        );
      case 'switch':
        return (
          <SwitchRow
            key={field.key}
            label={field.label}
            hint={field.hint}
            value={value === 'true'}
            onChange={(on) => set(field.key, String(on))}
          />
        );
      case 'choice':
        return (
          <View key={field.key} style={styles.choice} role="radiogroup">
            <Text variant="label">{field.label}</Text>
            <View style={styles.chips}>
              {field.options.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={value === option.value}
                  onPress={() => set(field.key, option.value)}
                />
              ))}
            </View>
            {errorOf(field) ? (
              <Text variant="caption" color="danger">
                {errorOf(field)}
              </Text>
            ) : null}
          </View>
        );
    }
  };

  const used = SECTION_ORDER.filter((section) =>
    fields.some((field) => (field.section ?? 'details') === section),
  );

  return (
    <>
      <BottomSheet
        visible={!confirming}
        title={t(`admin.${editing ? 'edit' : 'new'}_${config.resource}`)}
        onClose={onClose}
      >
        {used.map((section) => {
          const inSection = fields.filter((field) => (field.section ?? 'details') === section);
          // A form with one part needs no heading.
          return used.length > 1 ? (
            <FormSection key={section} title={t(`admin.section_${section}`)}>
              {inSection.map(renderField)}
            </FormSection>
          ) : (
            <View key={section} style={styles.plain}>
              {inSection.map(renderField)}
            </View>
          );
        })}
        {/* The fields may be scrolled out of view, so say here that some need fixing. */}
        <View
          accessibilityLiveRegion="polite"
          role={serverError || (showErrors && !valid) ? 'alert' : undefined}
        >
          {serverError ? (
            <Text color="danger">{serverError}</Text>
          ) : showErrors && !valid ? (
            <Text color="danger">{t('errors.VALIDATION_ERROR')}</Text>
          ) : null}
        </View>
        <Button label={t('admin.save')} onPress={submit} disabled={save.isPending} block />
        {editing ? (
          <FormSection title={t('admin.danger_title')}>
            <Text variant="caption" color="muted">
              {t(config.person ? 'admin.confirm_delete_person' : 'admin.confirm_delete_body')}
            </Text>
            <Button
              variant="danger"
              label={t('admin.delete')}
              onPress={() => setConfirming(true)}
              block
            />
          </FormSection>
        ) : null}
      </BottomSheet>
      {row ? (
        <ConfirmSheet
          visible={confirming}
          title={t('admin.confirm_delete_title', { name: config.titleOf(row) })}
          body={t(config.person ? 'admin.confirm_delete_person' : 'admin.confirm_delete_body')}
          confirmLabel={t('admin.delete')}
          cancelLabel={t('common.cancel')}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
          busy={save.isPending}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl },
  header: { gap: space.md, paddingBottom: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  choice: { gap: space.xs },
  plain: { gap: space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
    paddingVertical: space.xxs,
  },
});
