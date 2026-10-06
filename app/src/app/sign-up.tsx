/**
 * Create an account (CLAUDE.md Section 14, sign-up). Only university emails are accepted (the
 * API checks the domain). A student is signed in at once and lands on Home; a professor's
 * request waits for an administrator, so the screen says so and leads back to sign-in.
 * Fields are checked before sending, with the same rules as the API; each problem shows next
 * to its field, and the summary above the button is announced to screen readers.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useDepartments } from '@/api/queries';
import type { Honorific, Rank, SignUpBody } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DepartmentPicker } from '@/components/DepartmentPicker';
import { Door } from '@/components/Door';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { errorKey } from '@/lib/errors';
import {
  isUniversityEmail,
  patterns,
  UNIVERSITY_DOMAIN,
  universityNumberOf,
} from '@/lib/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

type Role = 'student' | 'professor';
type Field = 'full_name_ar' | 'full_name_en' | 'email' | 'password' | 'department';

const HONORIFICS: Honorific[] = ['dr', 'prof', 'mr', 'ms', 'eng'];
const RANKS: Rank[] = ['lecturer', 'assistant_professor', 'associate_professor', 'professor'];
const YEARS = [1, 2, 3, 4, 5, 6];
// API errors that belong to one field.
const FIELD_OF_ERROR: Record<string, Field> = {
  EMAIL_TAKEN: 'email',
  EMAIL_DOMAIN: 'email',
  STUDENT_EMAIL: 'email',
  UNIVERSITY_NO_TAKEN: 'email', // the number is the email's first part
};

export default function SignUpScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, signUp } = useAuth();
  const departments = useDepartments();

  const [role, setRole] = useState<Role>('student');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [studyYear, setStudyYear] = useState(1);
  const [honorific, setHonorific] = useState<Honorific>('dr');
  const [rank, setRank] = useState<Rank>('assistant_professor');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  if (state.status === 'signedIn') return <Redirect href="/" />;

  const number = universityNumberOf(email.trim().toLowerCase());

  const check = (): Partial<Record<Field, string>> => {
    const found: Partial<Record<Field, string>> = {};
    if (nameAr.trim().length < 2) found.full_name_ar = t('admin.name_short');
    if (nameEn.trim().length < 2) found.full_name_en = t('admin.name_short');
    const address = email.trim().toLowerCase();
    if (!patterns.email.test(address)) found.email = t('admin.email_format');
    else if (!isUniversityEmail(address))
      found.email = t('signup.email_domain', { domain: UNIVERSITY_DOMAIN });
    else if (role === 'student' && universityNumberOf(address) === null) {
      found.email = t('signup.email_student', { domain: UNIVERSITY_DOMAIN });
    }
    if (password.length < 8) found.password = t('admin.password_short');
    if (departmentId === null) found.department = t('signup.choose');
    return found;
  };

  const submit = async () => {
    if (busy) return;
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0 || departmentId === null) {
      setSummary(t('signup.check_fields'));
      return;
    }
    const account = {
      email: email.trim().toLowerCase(),
      password,
      full_name_ar: nameAr.trim(),
      full_name_en: nameEn.trim(),
      preferred_locale: language,
      department_id: departmentId,
    };
    const body: SignUpBody =
      role === 'student'
        ? { ...account, role, study_year: studyYear }
        : { ...account, role, honorific, academic_rank: rank };
    setBusy(true);
    setSummary(null);
    try {
      if ((await signUp(body)) === 'pending') {
        setPendingEmail(account.email);
        setBusy(false);
      } else {
        router.replace('/');
      }
    } catch (caught) {
      const message = t(errorKey(caught));
      const field = caught instanceof ApiError ? FIELD_OF_ERROR[caught.code] : undefined;
      if (field) setErrors({ [field]: message });
      setSummary(message);
      setBusy(false);
    }
  };

  const backToSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  const page = [
    styles.page,
    { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg },
  ];

  if (pendingEmail) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={page}>
        <Door status="away" size={56} />
        <View style={styles.intro}>
          <Text variant="display" role="heading">
            {t('signup.pending_title')}
          </Text>
          <Text>{t('signup.pending_body', { email: pendingEmail })}</Text>
        </View>
        <Button label={t('signup.back_to_sign_in')} onPress={backToSignIn} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={page}>
        <View style={styles.brand}>
          <Door status="in_office" size={40} />
          <Text variant="title" color="primary">
            {t('app.name')}
          </Text>
        </View>

        <View style={styles.intro}>
          <Text variant="display" role="heading">
            {t('signup.title')}
          </Text>
          <Text color="muted">{t('signup.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.group}>
            <Text variant="label">{t('signup.role')}</Text>
            <Segmented
              options={[
                { value: 'student' as const, label: t('signup.student') },
                { value: 'professor' as const, label: t('signup.professor') },
              ]}
              value={role}
              onChange={setRole}
            />
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
          <TextField
            label={t('signin.email')}
            helper={
              role === 'student'
                ? number
                  ? t('signup.number_found', { number })
                  : t('signup.email_helper_student', { domain: UNIVERSITY_DOMAIN })
                : t('signup.email_helper_professor', { domain: UNIVERSITY_DOMAIN })
            }
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            error={errors.email}
          />
          <TextField
            label={t('admin.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.password}
          />
          <View style={styles.reveal}>
            <Button
              variant="quiet"
              label={showPassword ? t('signin.hide_password') : t('signin.show_password')}
              onPress={() => setShowPassword((shown) => !shown)}
            />
          </View>

          <DepartmentPicker
            label={t('signup.department')}
            departments={departments.data ?? []}
            value={departmentId}
            onChange={setDepartmentId}
            error={errors.department}
            loading={departments.isPending}
            loadError={departments.error ? t(errorKey(departments.error)) : undefined}
            onRetry={() => departments.refetch()}
          />

          {role === 'student' ? (
            <>
              <ChoiceGroup label={t('signup.study_year')}>
                {YEARS.map((year) => (
                  <Chip
                    key={year}
                    label={String(year)}
                    accessibilityLabel={t('signup.year', { year })}
                    selected={studyYear === year}
                    onPress={() => setStudyYear(year)}
                  />
                ))}
              </ChoiceGroup>
            </>
          ) : (
            <>
              <ChoiceGroup label={t('admin.honorific')}>
                {HONORIFICS.map((h) => (
                  <Chip
                    key={h}
                    label={t(`honorific.${h}`)}
                    selected={honorific === h}
                    onPress={() => setHonorific(h)}
                  />
                ))}
              </ChoiceGroup>
              <ChoiceGroup label={t('admin.rank')}>
                {RANKS.map((r) => (
                  <Chip
                    key={r}
                    label={t(`rank.${r}`)}
                    selected={rank === r}
                    onPress={() => setRank(r)}
                  />
                ))}
              </ChoiceGroup>
            </>
          )}

          <View accessibilityLiveRegion="polite" role={summary ? 'alert' : undefined}>
            {summary ? <Text color="danger">{summary}</Text> : null}
          </View>

          <Button
            label={
              busy
                ? t('signup.submitting')
                : t(role === 'student' ? 'signup.submit_student' : 'signup.submit_professor')
            }
            onPress={submit}
            disabled={busy}
            block
          />
        </View>

        <View style={styles.footer}>
          <Button variant="quiet" label={t('signup.have_account')} onPress={backToSignIn} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A labelled row of chips (one choice); its error shows under it. */
function ChoiceGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text variant="label">{label}</Text>
      <View style={styles.chips} accessibilityLabel={label}>
        {children}
      </View>
      {error ? <Text color="danger">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: space.md, gap: space.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  intro: { gap: space.xs },
  form: { gap: space.md },
  group: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  reveal: { alignItems: 'flex-start' },
  footer: { alignItems: 'center', marginTop: 'auto' },
});
