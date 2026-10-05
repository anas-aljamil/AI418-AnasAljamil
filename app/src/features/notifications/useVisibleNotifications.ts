import { useNotifications } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { useSettings, wantsNotification } from '@/settings/SettingsProvider';

/** The notifications this phone shows (after the settings filter), and how many are unread. */
export function useVisibleNotifications() {
  const { state } = useAuth();
  // Admins get no notifications; students and professors poll every 20 s.
  const enabled = state.status === 'signedIn' && state.user.role !== 'admin';
  const query = useNotifications(enabled);
  const { notifications: prefs } = useSettings();
  const all = query.data ?? [];
  const visible = all.filter((n) => wantsNotification(prefs, n.type));
  return {
    query,
    visible,
    hidden: all.length - visible.length,
    unread: visible.filter((n) => !n.read_at).length,
  };
}
