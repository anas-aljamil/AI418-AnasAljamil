/** Conversation route: the full-screen thread (features/chat/ConversationThread). */
import { useLocalSearchParams } from 'expo-router';

import { RequireSignIn } from '@/auth/RequireSignIn';
import { ConversationThread } from '@/features/chat/ConversationThread';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequireSignIn>
      <ConversationThread conversationId={Number(id) || 0} />
    </RequireSignIn>
  );
}
