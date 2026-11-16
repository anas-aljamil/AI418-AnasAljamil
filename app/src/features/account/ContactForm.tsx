/**
 * "Write to us" on Help and contact (owner request 2026-11-16). The message is stored for the
 * administrator (POST /contact); Mawjood sends no email. Open without an account: a person who
 * cannot sign in is the one most likely to need it. When someone is signed in, their name and
 * email are filled in, and they may change the reply address.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/client';
import type { ContactTopic } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { errorKey } from '@/lib/errors';
import { fullName } from '@/lib/names';
import { patterns } from '@/lib/validation';
import { space, type Language } from '@/theme/tokens';

const TOPICS: ContactTopic[] = ['account', 'problem', 'idea', 'other'];
const MAX = 1000;

export function ContactForm() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { state } = useAuth();
  const user = state.status === 'signedIn' ? state.user : null;
  const [name, setName] = useState(user ? fullName(user, language) : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [topic, setTopic] = useState<ContactTopic>(user ? 'problem' : 'account');
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      api('/contact', 'POST', { name: name.trim(), email: email.trim(), topic, body: body.trim() }),
  });

  if (sentTo) {
    return (
      <View style={styles.form} accessibilityLiveRegion="polite" role="status">
        <Text weight="semibold">{t('help.sent_title')}</Text>
        <Text color="muted">{t('help.sent_body', { email: sentTo })}</Text>
        <View style={styles.start}>
          <Button
            variant="quiet"
            label={t('help.write_again')}
            onPress={() => {
              setBody('');
              setSentTo(null);
            }}
          />
        </View>
      </View>
    );
  }

  const submit = () => {
    // The same rules as the API, so the answer comes at once.
    const address = email.trim().toLowerCase();
    if (name.trim().length < 2) return setProblem(t('help.need_name'));
    if (!patterns.email.test(address)) return setProblem(t('help.need_email'));
    if (body.trim().length < 5) return setProblem(t('help.need_body'));
    setProblem(null);
    send.mutate(undefined, {
      onSuccess: () => setSentTo(address),
      onError: (error) => setProblem(t(errorKey(error))),
    });
  };

  return (
    <View style={styles.form}>
      <TextField
        label={t('help.name')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        maxLength={100}
      />
      <TextField
        label={t('help.email')}
        helper={t('help.email_helper')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        inputMode="email"
      />
      <View style={styles.group}>
        <Text variant="label">{t('help.topic')}</Text>
        <View style={styles.chips} accessibilityLabel={t('help.topic')}>
          {TOPICS.map((option) => (
            <Chip
              key={option}
              label={t(`help.topic_${option}`)}
              selected={topic === option}
              onPress={() => setTopic(option)}
            />
          ))}
        </View>
      </View>
      <TextField
        label={t('help.message')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MAX}
        counterLabel={(count) => t('help.counter', { count, max: MAX })}
      />
      <View accessibilityLiveRegion="polite" role={problem ? 'alert' : undefined}>
        {problem ? <Text color="danger">{problem}</Text> : null}
      </View>
      <View style={styles.start}>
        <Button label={t('help.send')} onPress={submit} disabled={send.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.sm },
  group: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignItems: 'flex-start' },
});
