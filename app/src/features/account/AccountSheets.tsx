/**
 * The two things a person changes about their own account, each in a sheet opened from
 * Profile or Account (owner request 2026-11-16):
 * - the password, which needs the current one (a forgotten password is set by the
 *   administrator, as the Help screen says);
 * - for a student, the study year and the department. The name, email and university number
 *   stay with the administrator.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/client';
import { useDepartments } from '@/api/queries';
import type { Me } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DepartmentPicker } from '@/components/DepartmentPicker';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';
import { space } from '@/theme/tokens';

const MIN_PASSWORD = 8;
const YEARS = [1, 2, 3, 4, 5, 6];

interface SheetProps {
  visible: boolean;
  onClose: () => void;
}

export function PasswordSheet({ visible, onClose }: SheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () =>
      api<void>('/auth/password', 'POST', { current_password: current, new_password: next }),
  });

  const close = () => {
    setCurrent('');
    setNext('');
    setAgain('');
    setShown(false);
    setProblem(null);
    onClose();
  };
  const save = () => {
    // The same rules as the API, checked first so the answer is immediate; the second copy of
    // the new password is checked here only (the API takes the password once).
    if (!current || next.length < MIN_PASSWORD) {
      setProblem(t(current ? 'account.password_short' : 'account.password_current_missing'));
      return;
    }
    if (again !== next) {
      setProblem(t('account.password_mismatch'));
      return;
    }
    setProblem(null);
    change.mutate(undefined, {
      onSuccess: () => {
        toast(t('account.password_changed'));
        close();
      },
      onError: (error) => setProblem(t(errorKey(error))),
    });
  };

  return (
    <BottomSheet visible={visible} title={t('account.change_password')} onClose={close}>
      <TextField
        label={t('account.password_current')}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
      />
      <TextField
        label={t('account.password_new')}
        value={next}
        onChangeText={setNext}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('account.password_confirm')}
        value={again}
        onChangeText={setAgain}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={save}
      />
      <View style={styles.start}>
        <Button
          variant="quiet"
          label={t(shown ? 'signin.hide_password' : 'signin.show_password')}
          onPress={() => setShown((on) => !on)}
        />
      </View>
      <View accessibilityLiveRegion="polite" role={problem ? 'alert' : undefined}>
        {problem ? <Text color="danger">{problem}</Text> : null}
      </View>
      <Button label={t('account.password_save')} onPress={save} disabled={change.isPending} block />
    </BottomSheet>
  );
}

export function StudySheet({ visible, onClose, user }: SheetProps & { user: Me }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { updateUser } = useAuth();
  const departments = useDepartments();
  const [year, setYear] = useState(user.student?.study_year ?? 1);
  const [departmentId, setDepartmentId] = useState(user.student?.department.department_id ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      api<Me>('/me/student', 'PATCH', { study_year: year, department_id: departmentId }),
  });

  return (
    <BottomSheet visible={visible} title={t('account.study_title')} onClose={onClose}>
      <View style={styles.group}>
        <Text variant="label">{t('signup.study_year')}</Text>
        <View style={styles.chips} accessibilityLabel={t('signup.study_year')}>
          {YEARS.map((option) => (
            <Chip
              key={option}
              label={String(option)}
              selected={year === option}
              onPress={() => setYear(option)}
            />
          ))}
        </View>
      </View>
      <DepartmentPicker
        label={t('signup.department')}
        departments={departments.data ?? []}
        value={departmentId}
        onChange={setDepartmentId}
        loading={departments.isPending}
        loadError={departments.error ? t(errorKey(departments.error)) : undefined}
        onRetry={() => departments.refetch()}
      />
      <Text variant="caption" color="muted">
        {t('account.study_note')}
      </Text>
      <View accessibilityLiveRegion="polite" role={problem ? 'alert' : undefined}>
        {problem ? <Text color="danger">{problem}</Text> : null}
      </View>
      <Button
        label={t('account.study_save')}
        disabled={save.isPending || departmentId === null}
        onPress={() => {
          setProblem(null);
          save.mutate(undefined, {
            onSuccess: (me) => {
              // The saved profile is what Home reads its department from.
              updateUser(me);
              toast(t('account.study_saved'));
              onClose();
            },
            onError: (error) => setProblem(t(errorKey(error))),
          });
        }}
        block
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start' },
  group: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
