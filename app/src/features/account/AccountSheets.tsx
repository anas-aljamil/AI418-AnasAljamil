/**
 * What a person changes about their own account, each in a sheet opened from Profile or
 * Account:
 * - the password, which needs the current one (a forgotten password is set by the
 *   administrator, as the Help screen says; 2026-11-16);
 * - for a student, the study year and the department (2026-11-16);
 * - the profile (owner request S5b, 2026-11-18): the photo, the name in both languages, the
 *   email for professors and admins (with the current password; a student's email is their
 *   university number, which stays with the administrator) and a professor's office.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/client';
import { useDepartments, useOffices } from '@/api/queries';
import type { Me } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PersonMark } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DepartmentPicker } from '@/components/DepartmentPicker';
import { MenuPicker } from '@/components/MenuPicker';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';
import { fullName, officeFull } from '@/lib/names';
import { canPickPhoto, pickPhoto } from '@/lib/pickPhoto';
import { isUniversityEmail, patterns, UNIVERSITY_DOMAIN } from '@/lib/validation';
import { space, type Language } from '@/theme/tokens';

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

type ProfileField = 'full_name_ar' | 'full_name_en' | 'email' | 'current_password';

export function ProfileSheet({ visible, onClose, user }: SheetProps & { user: Me }) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const { updateUser } = useAuth();
  const isProfessor = user.role === 'professor';
  const mayChangeEmail = user.role !== 'student';
  const offices = useOffices(visible && isProfessor);
  const [nameAr, setNameAr] = useState(user.full_name_ar);
  const [nameEn, setNameEn] = useState(user.full_name_en);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const savedOffice = String(user.professor?.office?.office_id ?? '');
  const [officeId, setOfficeId] = useState(savedOffice);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [problem, setProblem] = useState<string | null>(null);

  const address = email.trim().toLowerCase();
  const emailChanged = mayChangeEmail && address !== user.email;

  const save = useMutation({
    mutationFn: async () => {
      let me = user;
      const account: Record<string, string> = {};
      if (nameAr.trim() !== user.full_name_ar) account.full_name_ar = nameAr.trim();
      if (nameEn.trim() !== user.full_name_en) account.full_name_en = nameEn.trim();
      if (emailChanged) Object.assign(account, { email: address, current_password: password });
      if (Object.keys(account).length > 0) me = await api<Me>('/me/account', 'PATCH', account);
      if (isProfessor && officeId !== savedOffice) {
        me = await api<Me>('/me/professor', 'PATCH', {
          office_id: officeId ? Number(officeId) : null,
        });
      }
      return me;
    },
  });
  // A photo is saved as soon as it is chosen or removed, like the status tiles.
  const photo = useMutation({
    mutationFn: async (action: 'choose' | 'remove') => {
      if (action === 'remove') return api<Me>('/me/photo', 'DELETE');
      const picked = await pickPhoto().catch(() => {
        throw new Error('unreadable');
      });
      return picked ? api<Me>('/me/photo', 'PUT', picked) : null;
    },
  });
  const changePhoto = (action: 'choose' | 'remove') => {
    setProblem(null);
    photo.mutate(action, {
      onSuccess: (me) => {
        if (!me) return; // closed the picker without choosing
        updateUser(me);
        toast(t(action === 'remove' ? 'account.photo_removed' : 'account.photo_saved'));
      },
      onError: (error) =>
        setProblem(
          error instanceof Error && error.message === 'unreadable'
            ? t('account.photo_unreadable')
            : t(errorKey(error)),
        ),
    });
  };

  // The same rules as the API, checked first so each problem shows at its field.
  const check = (): Partial<Record<ProfileField, string>> => {
    const found: Partial<Record<ProfileField, string>> = {};
    if (nameAr.trim().length < 2) found.full_name_ar = t('admin.name_short');
    if (nameEn.trim().length < 2) found.full_name_en = t('admin.name_short');
    if (emailChanged) {
      if (!patterns.email.test(address)) found.email = t('admin.email_format');
      else if (isProfessor && !isUniversityEmail(address))
        found.email = t('signup.email_domain', { domain: UNIVERSITY_DOMAIN });
      if (!password) found.current_password = t('account.password_current_missing');
    }
    return found;
  };
  const submit = () => {
    const found = check();
    setErrors(found);
    setProblem(Object.keys(found).length > 0 ? t('signup.check_fields') : null);
    if (Object.keys(found).length > 0) return;
    save.mutate(undefined, {
      onSuccess: (me) => {
        updateUser(me);
        setPassword('');
        toast(t('account.profile_saved'));
        onClose();
      },
      onError: (error) => setProblem(t(errorKey(error))),
    });
  };

  const officeOptions = [
    { value: '', label: t('admin.no_office') },
    ...(offices.data ?? []).map((office) => ({
      value: String(office.office_id),
      label: officeFull(office, t),
    })),
  ];

  return (
    <BottomSheet visible={visible} title={t('account.profile_title')} onClose={onClose}>
      <View style={styles.photoRow}>
        <PersonMark
          userId={user.user_id}
          photoVersion={user.photo_updated_at}
          name={fullName(user, language)}
          size={72}
        />
        <View style={styles.photoText}>
          <Text variant="label">{t('account.photo')}</Text>
          <Text variant="caption" color="muted">
            {t(user.role === 'student' ? 'account.photo_seen_student' : 'account.photo_seen')}
          </Text>
          {canPickPhoto ? (
            <View style={styles.chips}>
              <Button
                variant="secondary"
                label={t(user.photo_updated_at ? 'account.photo_change' : 'account.photo_choose')}
                disabled={photo.isPending}
                onPress={() => changePhoto('choose')}
              />
              {user.photo_updated_at ? (
                <Button
                  variant="quiet"
                  label={t('account.photo_remove')}
                  disabled={photo.isPending}
                  onPress={() => changePhoto('remove')}
                />
              ) : null}
            </View>
          ) : (
            <Text variant="caption" color="muted">
              {t('account.photo_browser_only')}
            </Text>
          )}
        </View>
      </View>

      <TextField
        label={t('admin.name_ar')}
        value={nameAr}
        onChangeText={setNameAr}
        autoComplete="name"
        error={errors.full_name_ar}
      />
      <TextField
        label={t('admin.name_en')}
        value={nameEn}
        onChangeText={setNameEn}
        autoComplete="name"
        error={errors.full_name_en}
      />
      {mayChangeEmail ? (
        <>
          <TextField
            label={t('admin.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            error={errors.email}
          />
          {/* Asked only once the email is different, as the API asks. */}
          {emailChanged ? (
            <TextField
              label={t('account.email_password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              error={errors.current_password}
            />
          ) : null}
        </>
      ) : (
        <Text variant="caption" color="muted">
          {t('account.email_student_note', { email: user.email })}
        </Text>
      )}
      {isProfessor ? (
        <MenuPicker
          label={t('admin.office')}
          options={officeOptions}
          value={officeId}
          onChange={setOfficeId}
          placeholder={t('admin.no_office')}
        />
      ) : null}

      <View accessibilityLiveRegion="polite" role={problem ? 'alert' : undefined}>
        {problem ? <Text color="danger">{problem}</Text> : null}
      </View>
      <Button label={t('account.profile_save')} disabled={save.isPending} onPress={submit} block />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  photoText: { flex: 1, gap: space.xs },
  start: { alignItems: 'flex-start' },
  group: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
