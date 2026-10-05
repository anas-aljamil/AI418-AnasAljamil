/**
 * Student tabs (DESIGN.md Section 6): Home, Search, Appointments and Profile; Messages joins in
 * P5. Only signed-in students get here.
 */
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import House from 'lucide-react-native/icons/house';
import Search from 'lucide-react-native/icons/search';
import UserRound from 'lucide-react-native/icons/user-round';

import { useAuth } from '@/auth/AuthProvider';
import { tabIcon, useTabOptions } from '@/components/tabs';

export default function StudentTabs() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const options = useTabOptions();
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
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon(UserRound) }}
      />
    </Tabs>
  );
}
