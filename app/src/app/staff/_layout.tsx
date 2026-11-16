/** Professor tabs (DESIGN.md Section 6): Status, Requests, Schedule, Messages and Account. */
import { Redirect, Tabs, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import DoorOpen from 'lucide-react-native/icons/door-open';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import UserRound from 'lucide-react-native/icons/user-round';

import { useAuth } from '@/auth/AuthProvider';
import { signInHref } from '@/lib/nav';
import { messagesBadge, tabIcon, useTabOptions } from '@/components/tabs';
import { useUnread } from '@/api/queries';

export default function ProfessorTabs() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const pathname = usePathname();
  const options = useTabOptions();
  const unread = useUnread(state.status === 'signedIn');
  // Not signed in: to sign-in, and back here afterwards. Another role: to its own home.
  if (state.status !== 'signedIn') return <Redirect href={signInHref(pathname) as Href} />;
  if (state.user.role !== 'professor') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="status"
        options={{ title: t('tabs.status'), tabBarIcon: tabIcon(DoorOpen) }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: t('tabs.requests'), tabBarIcon: tabIcon(ClipboardList) }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: t('tabs.schedule'), tabBarIcon: tabIcon(CalendarClock) }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: tabIcon(MessageCircle),
          ...messagesBadge(unread.data?.messages, t),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tabs.account'), tabBarIcon: tabIcon(UserRound) }}
      />
    </Tabs>
  );
}
