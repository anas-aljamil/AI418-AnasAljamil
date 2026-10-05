/** Admin tabs: departments, offices, professors, students and account (phone layout). */
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Building from 'lucide-react-native/icons/building';
import DoorOpen from 'lucide-react-native/icons/door-open';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import UserRound from 'lucide-react-native/icons/user-round';
import Users from 'lucide-react-native/icons/users';

import { useAuth } from '@/auth/AuthProvider';
import { tabIcon, useTabOptions } from '@/components/tabs';

export default function AdminTabs() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const options = useTabOptions();
  if (state.status !== 'signedIn' || state.user.role !== 'admin') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="departments"
        options={{ title: t('tabs.departments'), tabBarIcon: tabIcon(Building) }}
      />
      <Tabs.Screen
        name="offices"
        options={{ title: t('tabs.offices'), tabBarIcon: tabIcon(DoorOpen) }}
      />
      <Tabs.Screen
        name="professors"
        options={{ title: t('tabs.professors'), tabBarIcon: tabIcon(Users) }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: t('tabs.students'), tabBarIcon: tabIcon(GraduationCap) }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tabs.account'), tabBarIcon: tabIcon(UserRound) }}
      />
    </Tabs>
  );
}
