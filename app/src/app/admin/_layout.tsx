/** Admin tabs: overview, campus (departments and offices), professors, students, account. */
import { Redirect, Tabs, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Landmark from 'lucide-react-native/icons/landmark';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import UserRound from 'lucide-react-native/icons/user-round';
import Users from 'lucide-react-native/icons/users';

import { useAuth } from '@/auth/AuthProvider';
import { signInHref } from '@/lib/nav';
import { tabIcon, useTabOptions } from '@/components/tabs';

export default function AdminTabs() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const pathname = usePathname();
  const options = useTabOptions();
  // Not signed in: to sign-in, and back here afterwards. Another role: to its own home.
  if (state.status !== 'signedIn') return <Redirect href={signInHref(pathname) as Href} />;
  if (state.user.role !== 'admin') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="overview"
        options={{ title: t('tabs.overview'), tabBarIcon: tabIcon(LayoutDashboard) }}
      />
      <Tabs.Screen
        name="campus"
        options={{ title: t('tabs.campus'), tabBarIcon: tabIcon(Landmark) }}
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
