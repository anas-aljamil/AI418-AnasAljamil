/**
 * Set a new password from the emailed link (owner request S5d, 2026-11-18):
 * /reset-password?token=... The new password is typed twice, as on sign-up; a link that was
 * used, is older than 30 minutes or was replaced by a newer one says so and leads to a new
 * request. After saving, the person signs in with the new password.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api, ApiError } from '@/api/client';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { errorKey } from '@/lib/errors';
import { space } from '@/theme/tokens';

const MIN_PASSWORD = 8;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; again?: string }>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [expired, setExpired] = useState(!token);
  const [done, setDone] = useState(false);
  const save = useMutation({
    mutationFn: () => api<void>('/auth/reset-password', 'POST', { token, new_password: password }),
  });

  const submit = () => {
    const found: typeof errors = {};
    if (password.length < MIN_PASSWORD) found.password = t('admin.password_short');
    else if (again !== password) found.again = t('admin.password_mismatch');
    setErrors(found);
    if (found.password || found.again) return;
    setProblem(null);
    save.mutate(undefined, {
      onSuccess: () => setDone(true),
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'RESET_LINK_INVALID') setExpired(true);
        else setProblem(t(errorKey(error)));
      },
    });
  };

  if (done) {
    return (
      <AuthFrame title={t('reset.done_title')}>
        <View style={styles.form}>
          <Text accessibilityLiveRegion="polite">{t('reset.done_body')}</Text>
          <Button label={t('signin.submit')} onPress={() => router.replace('/sign-in')} block />
        </View>
      </AuthFrame>
    );
  }

  if (expired) {
    // The closed door: this link no longer opens anything.
    return (
      <AuthFrame title={t('reset.invalid_title')} door="away">
        <View style={styles.form}>
          <Text>{t('reset.invalid_body')}</Text>
          <Button
            label={t('reset.new_link')}
            onPress={() => router.replace('/forgot-password')}
            block
          />
          <Button
            variant="quiet"
            label={t('signup.back_to_sign_in')}
            onPress={() => router.replace('/sign-in')}
          />
        </View>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <View style={styles.form}>
        <TextField
          label={t('admin.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
        />
        <TextField
          label={t('admin.password_confirm')}
          value={again}
          onChangeText={setAgain}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
          error={errors.again}
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
        <Button label={t('reset.save')} onPress={submit} disabled={save.isPending} block />
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  start: { alignItems: 'flex-start' },
});
