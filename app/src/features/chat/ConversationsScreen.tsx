/**
 * Messages tab (DESIGN.md 7.7), for students and professors: conversations with the latest
 * activity first, each with the other person, the last message and an unread count.
 */
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConversations } from '@/api/queries';
import type { Conversation } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { ListRow, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { shortWhen } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { participantName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

export function ConversationsScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const user = useUser();
  const conversations = useConversations();

  const row = (conversation: Conversation) => {
    const name = participantName(conversation.other, language, t);
    const last = conversation.last_message;
    const preview = last
      ? last.mine
        ? t('chat.you', { body: last.body })
        : last.body
      : t('chat.no_messages');
    const when = last ? shortWhen(new Date(last.created_at), now, t) : '';
    const unread = conversation.unread_count
      ? t('chat.unread', { count: conversation.unread_count })
      : null;
    return (
      <ListRow
        title={name}
        subtitle={preview}
        trailing={
          <View style={styles.trailing}>
            <Text variant="caption" color="muted">
              {when}
            </Text>
            {unread ? <Pill label={unread} tone="primary" /> : null}
          </View>
        }
        accessibilityLabel={spokenList([name, unread, preview, when], t)}
        onPress={() => router.push(`/conversations/${conversation.conversation_id}`)}
      />
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      data={conversations.data ?? []}
      keyExtractor={(c) => String(c.conversation_id)}
      renderItem={({ item }) => row(item)}
      ListHeaderComponent={
        <Text variant="heading" role="heading" style={styles.heading}>
          {t('chat.title')}
        </Text>
      }
      ListEmptyComponent={
        conversations.data === undefined && !conversations.error ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : conversations.error ? (
          <SectionError
            message={t(errorKey(conversations.error))}
            onRetry={() => conversations.refetch()}
          />
        ) : user.role === 'student' ? (
          <EmptyState
            title={t('chat.empty_title')}
            body={t('chat.empty_student')}
            actionLabel={t('chat.empty_action')}
            onAction={() => router.navigate('/search')}
          />
        ) : (
          <EmptyState title={t('chat.empty_title')} body={t('chat.empty_professor')} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl },
  heading: { marginBottom: space.sm },
  trailing: { alignItems: 'flex-end', gap: space.xxs },
});
