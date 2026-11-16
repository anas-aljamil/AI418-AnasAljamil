/**
 * Messages from Help and contact on the admin Overview (2026-11-16): the open ones, oldest
 * first, each with who wrote, the topic, when, the text, "Reply by email" (the admin's own mail
 * app; Mawjood sends no email) and "Mark as handled". Handled messages leave the list.
 */
import { Linking, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/client';
import type { ContactMessage, Page } from '@/api/types';
import { Button } from '@/components/Button';
import { SkeletonRow } from '@/components/Placeholders';
import { Card, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { shortWhen } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { scriptOf, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const KEY = ['admin', 'contact-messages', 'open'] as const;

export function ContactInbox() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const now = useNow();
  const client = useQueryClient();
  const inbox = useQuery({
    queryKey: KEY,
    queryFn: () =>
      api<Page<ContactMessage>>('/admin/contact-messages?handled=false&limit=100').then(
        (page) => page.items,
      ),
  });
  const handle = useMutation({
    mutationFn: (id: number) => api(`/admin/contact-messages/${id}`, 'PATCH', { handled: true }),
    onSuccess: () => toast(t('admin.contact_handled')),
    onError: (error) => toast(t(errorKey(error))),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });

  // Oldest first: the one waiting longest is answered first.
  const open = [...(inbox.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <Card>
      <Text variant="title" role="heading">
        {inbox.data ? t('admin.contact_title', { count: open.length }) : t('admin.contact_heading')}
      </Text>
      {inbox.error && !inbox.data ? (
        <SectionError message={t(errorKey(inbox.error))} onRetry={() => inbox.refetch()} />
      ) : !inbox.data ? (
        <SkeletonRow />
      ) : open.length === 0 ? (
        <Text color="muted">{t('admin.contact_none')}</Text>
      ) : (
        open.map((m) => {
          const when = shortWhen(new Date(m.created_at), now, t);
          const topic = t(`help.topic_${m.topic}`);
          return (
            <View key={m.contact_id} style={[styles.message, { borderTopColor: colors.line }]}>
              <View
                accessible
                accessibilityLabel={spokenList([m.sender_name, topic, when, m.body], t)}
                style={styles.text}
              >
                <View style={styles.top}>
                  <Text weight="semibold" lang={scriptOf(m.sender_name)} style={styles.grow}>
                    {m.sender_name}
                  </Text>
                  <Pill label={topic} />
                </View>
                <Text variant="caption" color="muted">
                  {spokenList(
                    [m.sender_email, when, m.user_id ? null : t('admin.contact_no_account')],
                    t,
                  )}
                </Text>
                <Text lang={scriptOf(m.body)}>{m.body}</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  variant="secondary"
                  label={t('admin.contact_reply')}
                  accessibilityLabel={t('admin.contact_reply_label', { name: m.sender_name })}
                  onPress={() => Linking.openURL(`mailto:${m.sender_email}`).catch(() => undefined)}
                />
                <Button
                  variant="quiet"
                  label={t('admin.contact_mark')}
                  accessibilityLabel={t('admin.contact_mark_label', { name: m.sender_name })}
                  disabled={handle.isPending}
                  onPress={() => handle.mutate(m.contact_id)}
                />
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  message: { gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  text: { gap: space.xxs },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
