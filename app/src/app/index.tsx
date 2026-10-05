import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { isLanguageChosen } from '@/i18n';

/** Where the app opens: language (first launch), then sign-in, then the home for the role. */
export default function Index() {
  const { state } = useAuth();
  if (!isLanguageChosen()) return <Redirect href="/language" />;
  if (state.status !== 'signedIn') return <Redirect href="/sign-in" />;
  const home = {
    student: '/home',
    professor: '/staff/status',
    admin: '/admin/departments',
  } as const;
  return <Redirect href={home[state.user.role]} />;
}
