/**
 * Admin CRUD on the phone (CLAUDE.md Section 3; DESIGN.md Section 11, product focus): one list
 * screen per table with search, Add, and a form sheet for create and edit. Field rules mirror
 * the API, so errors show next to the field before saving; the API's own answer (a duplicate
 * code or email, a department still in use) is shown above Save. Delete always asks first.
 */
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAdminList, useAdminSave, type AdminResource, type AdminRows } from '@/api/queries';
import type { Department } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DepartmentPicker } from '@/components/DepartmentPicker';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { ListRow, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export type FormValues = Record<string, string>;

interface BaseField {
  key: string;
  label: string;
  /** Only when creating (password) or only when editing (active). */
  only?: 'create' | 'edit';
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

/** A department, chosen from the menu grouped by college. */
export interface DepartmentFieldSpec extends BaseField {
  type: 'department';
  departments: Department[];
}

export type FieldSpec = TextFieldSpec | ChoiceFieldSpec | DepartmentFieldSpec;

export interface AdminConfig<R extends AdminResource> {
  resource: R;
  title: string;
  idOf: (row: AdminRows[R]) => number;
  titleOf: (row: AdminRows[R]) => string;
  subtitleOf?: (row: AdminRows[R]) => string;
  inactive?: (row: AdminRows[R]) => boolean;
  fields: FieldSpec[];
  /** Form values for a row (edit) or the defaults (create). */
  valuesOf: (row: AdminRows[R] | null) => FormValues;
  /** The request body; on edit an empty password is left out. */
  bodyOf: (values: FormValues, editing: boolean) => Record<string, unknown>;
  /** People get the stronger warning (their appointments and messages go too). */
  person?: boolean;
}

export function required(value: string) {
  return value.trim() ? null : 'admin.required';
}

export function AdminCrudScreen<R extends AdminResource>({ config }: { config: AdminConfig<R> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const list = useAdminList(config.resource);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ row: AdminRows[R] | null } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = list.data ?? [];
    if (!q) return all;
    return all.filter((row) =>
      `${config.titleOf(row)} ${config.subtitleOf?.(row) ?? ''}`.toLowerCase().includes(q),
    );
  }, [list.data, query, config]);

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="heading" role="heading" style={styles.grow}>
          {config.title}
        </Text>
        <Button label={t('admin.add')} onPress={() => setEditing({ row: null })} />
      </View>
      <TextField
        label={t('admin.search')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
        data={rows}
        keyExtractor={(row) => String(config.idOf(row))}
        renderItem={({ item }) => (
          <ListRow
            title={config.titleOf(item)}
            subtitle={config.subtitleOf?.(item)}
            trailing={config.inactive?.(item) ? <Pill label={t('admin.deactivated')} /> : null}
            onPress={() => setEditing({ row: item })}
          />
        )}
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
            <EmptyState title={t('admin.empty')} />
          )
        }
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      />
      {editing ? (
        <AdminForm
          key={editing.row ? config.idOf(editing.row) : 'new'}
          config={config}
          row={editing.row}
          onClose={() => setEditing(null)}
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

  return (
    <>
      <BottomSheet
        visible={!confirming}
        title={t(`admin.${editing ? 'edit' : 'new'}_${config.resource}`)}
        onClose={onClose}
      >
        {fields.map((field) =>
          field.type === 'text' ? (
            <TextField
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChangeText={(value) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: field.upper ? value.toUpperCase() : value,
                }))
              }
              error={showErrors && errors[field.key] ? t(errors[field.key]!) : undefined}
              secureTextEntry={field.secure}
              keyboardType={field.keyboard ?? 'default'}
              autoCapitalize={field.upper ? 'characters' : 'none'}
              autoCorrect={false}
              maxLength={field.maxLength}
            />
          ) : field.type === 'department' ? (
            <DepartmentPicker
              key={field.key}
              label={field.label}
              departments={field.departments}
              value={values[field.key] ? Number(values[field.key]) : null}
              onChange={(id) =>
                setValues((current) => ({ ...current, [field.key]: id === null ? '' : String(id) }))
              }
              error={showErrors && errors[field.key] ? t(errors[field.key]!) : undefined}
            />
          ) : (
            <View key={field.key} style={styles.choice} role="radiogroup">
              <Text variant="label">{field.label}</Text>
              <View style={styles.chips}>
                {field.options.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={values[field.key] === option.value}
                    onPress={() =>
                      setValues((current) => ({ ...current, [field.key]: option.value }))
                    }
                  />
                ))}
              </View>
              {showErrors && errors[field.key] ? (
                <Text variant="caption" color="danger">
                  {t(errors[field.key]!)}
                </Text>
              ) : null}
            </View>
          ),
        )}
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
          <Button
            variant="danger"
            label={t('admin.delete')}
            onPress={() => setConfirming(true)}
            block
          />
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
  choice: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
