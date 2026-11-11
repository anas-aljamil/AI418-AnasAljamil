/** Conversation route: the full-screen thread (features/chat/ConversationThread). */
import { useLocalSearchParams } from 'expo-router';

import { ConversationThread } from '@/features/chat/ConversationThread';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationThread conversationId={Number(id) || 0} />;
}
