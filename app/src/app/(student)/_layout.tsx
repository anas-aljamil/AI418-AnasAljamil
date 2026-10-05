/**
 * Student tabs (DESIGN.md Section 6): Home, Search, Appointments, Messages (with the unread
 * count) and Profile. Only signed-in students get here.
 */
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import House from 'lucide-react-native/icons/house';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Search from 'lucide-react-native/icons/search';
import UserRound from 'lucide-react-native/icons/user-round';

import { useAuth } from '@/auth/AuthProvider';
import { messagesBadge, tabIcon, useTabOptions } from '@/components/tabs';
import { useUnread } from '@/api/queries';

export default function StudentTabs() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const options = useTabOptions();
  const unread = useUnread(state.status === 'signedIn');
  if (state.status !== 'signedIn' || state.user.role !== 'student') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen
        name="search"
        options={{ title: t('tabs.search'), tabBarIcon: tabIcon(Search) }}
      />
      <Tabs.Screen
        name="appointments"
        options={{ title: t('tabs.appointments'), tabBarIcon: tabIcon(CalendarDays) }}
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
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon(UserRound) }}
      />
    </Tabs>
  );
}
