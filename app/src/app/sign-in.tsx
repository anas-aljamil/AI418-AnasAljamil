/**
 * Sign in with a university email (DESIGN.md 7.1). The role comes from the account.
 * Return on the email field moves to the password; return on the password signs in.
 * Errors say what happened and how to fix it, and are announced to screen readers.
 * New users go to Create an account (sign-up.tsx).
 */
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInputInstance,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Languages from 'lucide-react-native/icons/languages';

import { useColumn } from '@/lib/layout';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Door } from '@/components/Door';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { currentLanguage, switchLanguage } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn('narrow');
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  if (state.status === 'signedIn') return <Redirect href="/" />;

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError(t('signin.missing'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (caught) {
      setError(t(errorKey(caught)));
      setBusy(false);
    }
  };

  const otherLanguage = currentLanguage() === 'ar' ? 'en' : 'ar';

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.page,
          column,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        {/* The app opens here; the language switch sits in the top corner (owner, 2026-11-10). */}
        <View style={styles.top}>
          <View style={styles.brand}>
            <Door status="in_office" size={40} />
            <Text variant="title" color="primary">
              {t('app.name')}
            </Text>
          </View>
          <Button
            variant="quiet"
            label={t(`settings.language_${otherLanguage}`)}
            accessibilityLabel={t('signin.language', {
              language: t(`settings.language_${otherLanguage}`),
            })}
            icon={<Languages color={colors.primary} size={20} strokeWidth={1.75} />}
            onPress={() => switchLanguage(otherLanguage)}
          />
        </View>

        <View style={styles.intro}>
          <Text variant="display" role="heading">
            {t('signin.title')}
          </Text>
          <Text color="muted">{t('signin.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label={t('signin.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            inputMode="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label={t('signin.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <View style={styles.reveal}>
            <Button
              variant="quiet"
              label={showPassword ? t('signin.hide_password') : t('signin.show_password')}
              onPress={() => setShowPassword((shown) => !shown)}
            />
          </View>

          {/* Announced when it appears (live region on Android and web, alert role on iOS). */}
          <View accessibilityLiveRegion="polite" role={error ? 'alert' : undefined}>
            {error ? <Text color="danger">{error}</Text> : null}
          </View>

          <Button
            label={busy ? t('signin.submitting') : t('signin.submit')}
            onPress={submit}
            disabled={busy}
            block
          />
          <Button
            variant="quiet"
            label={t('signup.link')}
            onPress={() => router.push('/sign-up')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: space.md, gap: space.xl },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  intro: { gap: space.xs },
  form: { gap: space.sm },
  reveal: { alignItems: 'flex-start' },
});
