/**
 * Sign in with a university email (DESIGN.md 7.1), inside the band frame shared with sign-up
 * (features/auth/AuthFrame.tsx). The role comes from the account.
 * Return on the email field moves to the password; return on the password signs in.
 * Errors say what happened and how to fix it, and are announced to screen readers.
 * New users go to Create an account (sign-up.tsx).
 */
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Languages from 'lucide-react-native/icons/languages';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { demoAccounts } from '@/features/auth/demo';
import { currentLanguage, switchLanguage } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { safeNext } from '@/lib/nav';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { state, signIn } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  // A visitor who opened a link while signed out goes on to it; otherwise to the role's home.
  const destination = (safeNext(next) ?? '/') as Href;
  if (state.status === 'signedIn') return <Redirect href={destination} />;

  const enter = async (asEmail: string, withPassword: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(asEmail, withPassword);
      router.replace(destination);
    } catch (caught) {
      setError(t(errorKey(caught)));
      setBusy(false);
    }
  };

  const submit = () => {
    if (!email.trim() || !password) {
      setError(t('signin.missing'));
      return;
    }
    enter(email, password);
  };
  const demo = demoAccounts(process.env.EXPO_PUBLIC_DEMO);

  const otherLanguage = currentLanguage() === 'ar' ? 'en' : 'ar';

  return (
    <AuthFrame
      title={t('signin.title')}
      subtitle={t('signin.subtitle')}
      // The app opens here; the language switch sits in the top corner (owner, 2026-11-10).
      action={
        <Button
          variant="onBand"
          label={t(`settings.language_${otherLanguage}`)}
          accessibilityLabel={t('signin.language', {
            language: t(`settings.language_${otherLanguage}`),
          })}
          icon={<Languages color={colors.onBand} size={20} strokeWidth={1.75} />}
          onPress={() => switchLanguage(otherLanguage)}
        />
      }
    >
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
        <Button variant="quiet" label={t('signup.link')} onPress={() => router.push('/sign-up')} />
        <Button variant="quiet" label={t('help.title')} onPress={() => router.push('/help')} />
        {demo ? (
          // Only in a build made for showing the app (EXPO_PUBLIC_DEMO=1).
          <View style={styles.demo}>
            <Text variant="label" role="heading">
              {t('signin.demo_title')}
            </Text>
            <Text variant="caption" color="muted">
              {t('signin.demo_body')}
            </Text>
            <View style={styles.demoButtons}>
              <Button
                variant="secondary"
                label={t('signin.demo_student')}
                disabled={busy}
                onPress={() => enter(demo.student, demo.password)}
              />
              <Button
                variant="secondary"
                label={t('signin.demo_professor')}
                disabled={busy}
                onPress={() => enter(demo.professor, demo.password)}
              />
            </View>
          </View>
        ) : null}
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.sm },
  reveal: { alignItems: 'flex-start' },
  demo: { gap: space.xs, marginTop: space.md },
  demoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
