/**
 * Forgot password (owner request S5d, 2026-11-18), reached from sign-in. The person types
 * their university email and Mawjood emails a link that works once, for 30 minutes. The
 * screen says the same thing whether or not the address has an account (the API answers the
 * same way), so nobody can use it to learn who has one.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/client';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { errorKey } from '@/lib/errors';
import { patterns } from '@/lib/validation';
import { space } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (address: string) => api<void>('/auth/forgot-password', 'POST', { email: address }),
  });

  const backToSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  const submit = () => {
    const address = email.trim().toLowerCase();
    if (!patterns.email.test(address)) {
      setProblem(t('admin.email_format'));
      return;
    }
    setProblem(null);
    send.mutate(address, {
      onSuccess: () => setSentTo(address),
      onError: (error) => setProblem(t(errorKey(error))),
    });
  };

  if (sentTo) {
    return (
      <AuthFrame title={t('forgot.sent_title')}>
        <View style={styles.form}>
          <Text accessibilityLiveRegion="polite">{t('forgot.sent_body', { email: sentTo })}</Text>
          <Text color="muted">{t('forgot.sent_hint')}</Text>
          <Button label={t('signup.back_to_sign_in')} onPress={backToSignIn} block />
          <Button variant="quiet" label={t('forgot.try_again')} onPress={() => setSentTo(null)} />
        </View>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      <View style={styles.form}>
        <TextField
          label={t('signin.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={submit}
          error={problem ?? undefined}
        />
        <Button
          label={send.isPending ? t('forgot.sending') : t('forgot.send')}
          onPress={submit}
          disabled={send.isPending}
          block
        />
        <Button variant="quiet" label={t('signup.back_to_sign_in')} onPress={backToSignIn} />
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
