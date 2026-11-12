/**
 * A conversation (DESIGN.md 7.7). Bubbles follow the reading direction: your messages at the
 * end edge, theirs at the start edge. Days get a separator, times are grouped (one per burst
 * from the same person), and your latest message says Sending, Sent or Read. A message shows
 * at once; if it fails it stays with "Not sent. Tap to try again." Professors get quick
 * replies. The composer stays above the keyboard. Opening the thread marks it read.
 * While the professor's closed hours are on, a student reads the thread but the composer is
 * replaced by when messages open again; the professor sees the same time and can still write.
 * On desktop the thread also opens in a pane beside the conversation list (Messages tab), with
 * no back button there (docs/desktop-plan.md).
 * Message actions (owner request 2026-11-11): tapping a message (or a long press) opens Reply,
 * Copy (browser), Edit (your own, for 15 minutes) and Delete (your own, for both sides, after a
 * confirmation). A reply shows the message it quotes inside its bubble, and tapping the quote
 * scrolls to that message; a deleted message keeps its place as "This message was deleted";
 * an edited one says "edited" with its time. Reply and Edit show a bar above the composer
 * with a button that cancels them.
 */
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import X from 'lucide-react-native/icons/x';

import {
  useConversations,
  useDeleteMessage,
  useEditMessage,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/api/queries';
import type { ChatMessage, QuotedMessage } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SkeletonRow } from '@/components/Placeholders';
import { IconButton } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { clockText, laterText, riyadhDayDifference, riyadhTime, shortWhen } from '@/lib/format';
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
  reply_to: QuotedMessage | null;
}

/** The browser can copy text; React Native would need another library (none added). */
function canCopy(): boolean {
  return (
    Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText
  );
}

type Item = { kind: 'sent'; message: ChatMessage } | { kind: 'outgoing'; message: Outgoing };

let outgoingCount = 0;
function newOutgoing(body: string, replyTo: QuotedMessage | null): Outgoing {
  outgoingCount += 1;
  return {
    key: `local-${outgoingCount}`,
    body,
    state: 'sending',
    created_at: new Date().toISOString(),
    reply_to: replyTo,
  };
}

interface ConversationThreadProps {
  conversationId: number;
  /** Shown in a pane beside the conversation list (desktop): no back button. */
  pane?: boolean;
}

export function ConversationThread({ conversationId, pane = false }: ConversationThreadProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const user = useUser();
  const conversation = useConversations().data?.find((c) => c.conversation_id === conversationId);
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const edit = useEditMessage(conversationId);
  const remove = useDeleteMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const toast = useToast();
  const list = useRef<FlatList<Item>>(null);
  const [draft, setDraft] = useState('');
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The message whose actions are open, the one being answered or changed, and the one
  // waiting for the delete confirmation.
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);

  const name = conversation ? participantName(conversation.other, language, t) : '';
  // Polled with the conversation list; compared with the clock so it reopens on time.
  const closedUntil =
    conversation?.closed_until && new Date(conversation.closed_until) > now
      ? new Date(conversation.closed_until)
      : null;
  const studentBlocked = user.role === 'student' && closedUntil !== null;
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
    send.mutate(
      { body: item.body, reply_to_id: item.reply_to?.message_id ?? null },
      {
        onSuccess: () => setOutbox((current) => current.filter((o) => o.key !== item.key)),
        onError: (failure) => {
          setOutbox((current) =>
            current.map((o) => (o.key === item.key ? { ...o, state: 'failed' } : o)),
          );
          setError(t(errorKey(failure)));
        },
      },
    );
  };

  const quoteOf = (message: ChatMessage): QuotedMessage => ({
    message_id: message.message_id,
    mine: message.mine,
    body: message.body,
  });

  const submit = (body: string) => {
    const text = body.trim();
    if (!text) return;
    if (editing) {
      setError(null);
      edit.mutate(
        { id: editing.message_id, body: text },
        {
          onSuccess: () => {
            setEditing(null);
            setDraft('');
          },
          onError: (failure) => setError(t(errorKey(failure))),
        },
      );
      return;
    }
    setDraft('');
    deliver(newOutgoing(text, replyTo ? quoteOf(replyTo) : null));
    setReplyTo(null);
  };

  const startEdit = (message: ChatMessage) => {
    setReplyTo(null);
    setEditing(message);
    setDraft(message.body ?? '');
  };
  const copy = (message: ChatMessage) => {
    navigator.clipboard
      .writeText(message.body ?? '')
      .then(() => toast(t('chat.copied')))
      .catch(() => undefined);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.message_id, {
      onSuccess: () => {
        if (editing?.message_id === deleting.message_id) {
          setEditing(null);
          setDraft('');
        }
        setDeleting(null);
      },
      onError: (failure) => {
        setDeleting(null);
        setError(t(errorKey(failure)));
      },
    });
  };
  /** Scrolls to the quoted message when it is loaded. */
  const showQuoted = (id: number) => {
    const index = items.findIndex((i) => i.kind === 'sent' && i.message.message_id === id);
    if (index >= 0) list.current?.scrollToIndex({ index, viewPosition: 0.5 });
  };
  const canEdit = (message: ChatMessage) =>
    !!message.editable_until && new Date(message.editable_until) > now && !studentBlocked;

  // Newest first, for the inverted list: unconfirmed messages, then the server's.
  const items: Item[] = [
    ...outbox.map((message) => ({ kind: 'outgoing' as const, message })),
    ...(messages.data ?? []).map((message) => ({ kind: 'sent' as const, message })),
  ];
  const latestMine = (messages.data ?? []).find((m) => m.mine)?.message_id;
  // Icons are drawings: layout direction moves them but never mirrors them, so the back
  // arrow is flipped for Arabic on every platform.
  const flip = language === 'ar';

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
    const sent = item.kind === 'sent' ? item.message : null;
    const deleted = !!sent?.deleted_at;
    const edited = !!sent?.edited_at && !deleted;
    const meta = spokenList(
      [showTime ? clockText(riyadhTime(at), t) : null, edited ? t('chat.edited') : null, receipt],
      t,
    );
    const failed = item.kind === 'outgoing' && item.message.state === 'failed';
    const quoted = item.message.reply_to;
    const quoteName = (q: QuotedMessage) => (q.mine ? t('chat.me') : name);
    const text = deleted ? t('chat.deleted') : (message.body ?? '');
    return (
      <View>
        {firstOfDay ? (
          <Text variant="caption" color="muted" style={styles.day}>
            {riyadhDayDifference(at, now) === 0 ? t('chat.today') : shortWhen(at, now, t)}
          </Text>
        ) : null}
        <Pressable
          disabled={deleted || (item.kind === 'outgoing' && !failed)}
          onPress={() =>
            item.kind === 'outgoing' ? deliver(item.message) : setActionsFor(item.message)
          }
          onLongPress={sent && !deleted ? () => setActionsFor(sent) : undefined}
          accessibilityRole={failed || (sent && !deleted) ? 'button' : undefined}
          accessibilityLabel={spokenList(
            [
              quoted
                ? t('chat.quote_label', {
                    name: quoteName(quoted),
                    body: quoted.body ?? t('chat.deleted'),
                  })
                : null,
              text,
            ],
            t,
          )}
          accessibilityHint={sent && !deleted ? t('chat.bubble_hint') : undefined}
          style={[
            styles.bubble,
            deleted
              ? [
                  mine ? styles.mine : styles.theirs,
                  styles.deleted,
                  { borderColor: colors.line, backgroundColor: 'transparent' },
                ]
              : mine
                ? [styles.mine, { backgroundColor: colors.primary }]
                : [styles.theirs, { backgroundColor: colors.surface, borderColor: colors.line }],
            item.kind === 'outgoing' && item.message.state === 'sending' && styles.pending,
          ]}
        >
          {quoted && !deleted ? (
            <Pressable
              onPress={() => showQuoted(quoted.message_id)}
              accessibilityRole="button"
              accessibilityLabel={t('chat.quote_label', {
                name: quoteName(quoted),
                body: quoted.body ?? t('chat.deleted'),
              })}
              style={[styles.quote, { borderColor: mine ? colors.onPrimary : colors.primary }]}
            >
              <Text variant="caption" weight="semibold" color={mine ? 'onPrimary' : 'primary'}>
                {quoteName(quoted)}
              </Text>
              <Text variant="caption" color={mine ? 'onPrimary' : 'muted'} numberOfLines={2}>
                {quoted.body ?? t('chat.deleted')}
              </Text>
            </Pressable>
          ) : null}
          <Text
            color={deleted ? 'muted' : mine ? 'onPrimary' : 'text'}
            style={deleted ? styles.deletedText : undefined}
          >
            {text}
          </Text>
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
          {
            paddingTop: pane ? space.sm : insets.top + space.xs,
            borderBottomColor: colors.line,
          },
          pane && styles.paneHeader,
        ]}
      >
        {pane ? null : (
          <IconButton
            label={t('prof.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            icon={
              <View style={flip ? styles.flipped : undefined}>
                <ChevronLeft color={colors.text} size={26} strokeWidth={1.75} />
              </View>
            }
          />
        )}
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
          ref={list}
          inverted
          onScrollToIndexFailed={() => undefined}
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
          {closedUntil ? (
            <Text
              color={studentBlocked ? 'text' : 'muted'}
              weight={studentBlocked ? 'medium' : undefined}
            >
              {t(studentBlocked ? 'chat.closed_until' : 'chat.closed_for_professor', {
                name,
                time: laterText(closedUntil, now, t),
              })}
            </Text>
          ) : null}
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
        {replyTo || editing ? (
          <View style={[styles.banner, { borderColor: colors.primary }]}>
            <View style={styles.grow}>
              <Text variant="caption" weight="semibold" color="primary">
                {editing
                  ? t('chat.editing')
                  : t('chat.replying_to', { name: replyTo!.mine ? t('chat.me') : name })}
              </Text>
              {replyTo ? (
                <Text variant="caption" color="muted" numberOfLines={1}>
                  {replyTo.body ?? t('chat.deleted')}
                </Text>
              ) : null}
            </View>
            <IconButton
              label={editing ? t('chat.cancel_edit') : t('chat.cancel_reply')}
              onPress={() => {
                if (editing) setDraft('');
                setEditing(null);
                setReplyTo(null);
              }}
              icon={<X color={colors.muted} size={20} strokeWidth={1.75} />}
            />
          </View>
        ) : null}
        {studentBlocked ? null : (
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
            <Button
              label={editing ? t('chat.save_edit') : t('chat.send')}
              onPress={() => submit(draft)}
              disabled={!draft.trim() || edit.isPending}
            />
          </View>
        )}
      </View>

      <BottomSheet
        visible={actionsFor !== null}
        title={t('chat.message_actions')}
        onClose={() => setActionsFor(null)}
      >
        {actionsFor ? (
          <View style={styles.actions}>
            <Text color="muted" numberOfLines={3}>
              {actionsFor.body}
            </Text>
            {studentBlocked ? null : (
              <Button
                variant="secondary"
                label={t('chat.reply')}
                block
                onPress={() => {
                  setEditing(null);
                  setReplyTo(actionsFor);
                  setActionsFor(null);
                }}
              />
            )}
            {canCopy() ? (
              <Button
                variant="secondary"
                label={t('chat.copy')}
                block
                onPress={() => {
                  copy(actionsFor);
                  setActionsFor(null);
                }}
              />
            ) : null}
            {canEdit(actionsFor) ? (
              <Button
                variant="secondary"
                label={t('chat.edit')}
                block
                onPress={() => {
                  startEdit(actionsFor);
                  setActionsFor(null);
                }}
              />
            ) : null}
            {actionsFor.mine ? (
              <Button
                variant="danger"
                label={t('chat.delete_message')}
                block
                onPress={() => {
                  setDeleting(actionsFor);
                  setActionsFor(null);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
      <ConfirmSheet
        visible={deleting !== null}
        title={t('chat.delete_title')}
        body={t('chat.delete_body')}
        confirmLabel={t('chat.delete_message')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  paneHeader: { paddingHorizontal: space.lg, minHeight: 64 },
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
  deleted: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  deletedText: { fontStyle: 'italic' },
  quote: {
    borderStartWidth: space.xxs,
    paddingStart: space.xs,
    marginBottom: space.xxs,
    gap: space.xxs,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderStartWidth: space.xxs,
    paddingStart: space.sm,
  },
  actions: { gap: space.xs },
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
