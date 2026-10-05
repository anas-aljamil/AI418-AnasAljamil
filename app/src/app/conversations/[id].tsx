/**
 * A conversation (DESIGN.md 7.7). Bubbles follow the reading direction: your messages at the
 * end edge, theirs at the start edge. Days get a separator, times are grouped (one per burst
 * from the same person), and your latest message says Sending, Sent or Read. A message shows
 * at once; if it fails it stays with "Not sent. Tap to try again." Professors get quick
 * replies. The composer stays above the keyboard. Opening the thread marks it read.
 */
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import {
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/api/queries';
import type { ChatMessage } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { SkeletonRow } from '@/components/Placeholders';
import { IconButton } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { riyadhDayDifference, riyadhTime, shortWhen } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { participantName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, type Language } from '@/theme/tokens';

const GROUP_MS = 5 * 60_000; // one time label per burst of messages
const QUICK_REPLIES = ['quick_come_now', 'quick_late', 'quick_reschedule'] as const;

/** A message the server has not confirmed yet. */
interface Outgoing {
  key: string;
  body: string;
  state: 'sending' | 'failed';
  created_at: string;
}

type Item = { kind: 'sent'; message: ChatMessage } | { kind: 'outgoing'; message: Outgoing };

let outgoingCount = 0;
function newOutgoing(body: string): Outgoing {
  outgoingCount += 1;
  return {
    key: `local-${outgoingCount}`,
    body,
    state: 'sending',
    created_at: new Date().toISOString(),
  };
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id) || 0;
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const user = useUser();
  const conversation = useConversations().data?.find((c) => c.conversation_id === conversationId);
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const [draft, setDraft] = useState('');
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const name = conversation ? participantName(conversation.other, language, t) : '';
  // Mark the thread read once per newest unread message: not again when the request ends
  // (a failure would otherwise retry in a tight loop), only when a newer message arrives.
  const newestUnread = (messages.data ?? []).find((m) => !m.mine && !m.read_at)?.message_id;
  const markedUpTo = useRef<number | undefined>(undefined);
  const { mutate: markAsRead } = markRead;
  useEffect(() => {
    if (newestUnread !== undefined && newestUnread !== markedUpTo.current) {
      markedUpTo.current = newestUnread;
      markAsRead();
    }
  }, [newestUnread, markAsRead]);

  const deliver = (item: Outgoing) => {
    setOutbox((current) => [
      { ...item, state: 'sending' },
      ...current.filter((o) => o.key !== item.key),
    ]);
    setError(null);
    send.mutate(item.body, {
      onSuccess: () => setOutbox((current) => current.filter((o) => o.key !== item.key)),
      onError: (failure) => {
        setOutbox((current) =>
          current.map((o) => (o.key === item.key ? { ...o, state: 'failed' } : o)),
        );
        setError(t(errorKey(failure)));
      },
    });
  };

  const submit = (body: string) => {
    const text = body.trim();
    if (!text) return;
    setDraft('');
    deliver(newOutgoing(text));
  };

  // Newest first, for the inverted list: unconfirmed messages, then the server's.
  const items: Item[] = [
    ...outbox.map((message) => ({ kind: 'outgoing' as const, message })),
    ...(messages.data ?? []).map((message) => ({ kind: 'sent' as const, message })),
  ];
  const latestMine = (messages.data ?? []).find((m) => m.mine)?.message_id;
  const flip = language === 'ar' && !I18nManager.isRTL;

  const renderItem = ({ item, index }: { item: Item; index: number }) => {
    const message = item.message;
    const mine = item.kind === 'outgoing' || item.message.mine;
    const at = new Date(message.created_at);
    const older = items[index + 1]?.message;
    const newer = items[index - 1];
    const firstOfDay = !older || riyadhDayDifference(at, new Date(older.created_at)) !== 0;
    const newerMine = newer ? newer.kind === 'outgoing' || newer.message.mine : null;
    const showTime =
      !newer ||
      newerMine !== mine ||
      new Date(newer.message.created_at).getTime() - at.getTime() > GROUP_MS;
    let receipt: string | null = null;
    if (item.kind === 'outgoing') {
      receipt = item.message.state === 'failed' ? t('chat.failed') : t('chat.sending');
    } else if (item.message.message_id === latestMine && outbox.length === 0) {
      receipt = item.message.read_at ? t('chat.read') : t('chat.sent');
    }
    const meta = spokenList([showTime ? riyadhTime(at) : null, receipt], t);
    const failed = item.kind === 'outgoing' && item.message.state === 'failed';
    return (
      <View>
        {firstOfDay ? (
          <Text variant="caption" color="muted" style={styles.day}>
            {riyadhDayDifference(at, now) === 0 ? t('chat.today') : shortWhen(at, now, t)}
          </Text>
        ) : null}
        <Pressable
          disabled={!failed}
          onPress={() => item.kind === 'outgoing' && deliver(item.message)}
          accessibilityRole={failed ? 'button' : undefined}
          style={[
            styles.bubble,
            mine
              ? [styles.mine, { backgroundColor: colors.primary }]
              : [styles.theirs, { backgroundColor: colors.surface, borderColor: colors.line }],
            item.kind === 'outgoing' && item.message.state === 'sending' && styles.pending,
          ]}
        >
          <Text color={mine ? 'onPrimary' : 'text'}>{message.body}</Text>
        </Pressable>
        {meta ? (
          <Text
            variant="caption"
            color={failed ? 'danger' : 'muted'}
            style={mine ? styles.metaMine : styles.metaTheirs}
          >
            {meta}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.xs, borderBottomColor: colors.line },
        ]}
      >
        <IconButton
          label={t('prof.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          icon={
            <View style={flip ? styles.flipped : undefined}>
              <ChevronLeft color={colors.text} size={26} strokeWidth={1.75} />
            </View>
          }
        />
        <View style={styles.grow}>
          <Text variant="title" role="heading" numberOfLines={1}>
            {name}
          </Text>
          {conversation ? (
            <Text variant="caption" color="muted">
              {t(`chat.${conversation.other.role}`)}
            </Text>
          ) : null}
        </View>
      </View>

      {messages.data === undefined && !messages.error ? (
        <View style={styles.list}>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : messages.error && !messages.data ? (
        <View style={styles.list}>
          <Text variant="title">{t('chat.load_failed')}</Text>
          <SectionError message={t(errorKey(messages.error))} onRetry={() => messages.refetch()} />
        </View>
      ) : (
        <FlatList
          inverted
          style={styles.fill}
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) =>
            item.kind === 'sent' ? String(item.message.message_id) : item.message.key
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <Text color="muted" style={styles.empty}>
              {t('chat.no_messages')}
            </Text>
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.line,
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + space.sm,
          },
        ]}
      >
        <View accessibilityLiveRegion="polite">
          {error ? <Text color="danger">{error}</Text> : null}
        </View>
        {user.role === 'professor' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row} accessibilityLabel={t('chat.quick_replies')}>
              {QUICK_REPLIES.map((key) => (
                <Chip key={key} label={t(`chat.${key}`)} onPress={() => submit(t(`chat.${key}`))} />
              ))}
            </View>
          </ScrollView>
        ) : null}
        <View style={styles.composeRow}>
          <View style={styles.grow}>
            <TextField
              label={t('chat.composer', { name })}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={1000}
              counterLabel={() => ''}
            />
          </View>
          <Button label={t('chat.send')} onPress={() => submit(draft)} disabled={!draft.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  flipped: { transform: [{ scaleX: -1 }] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { paddingHorizontal: space.md, paddingVertical: space.md, gap: space.xxs },
  empty: { textAlign: 'center', marginVertical: space.lg },
  day: { textAlign: 'center', marginVertical: space.sm },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radii.card,
  },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  pending: { opacity: 0.7 },
  metaMine: { alignSelf: 'flex-end', marginBottom: space.xs },
  metaTheirs: { alignSelf: 'flex-start', marginBottom: space.xs },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.xs,
  },
  row: { flexDirection: 'row', gap: space.xs },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
});
