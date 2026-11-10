import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';

/**
 * Where the app opens: sign-in (in the device language until one is chosen there), then the
 * home for the role.
 */
export default function Index() {
  const { state } = useAuth();
  if (state.status !== 'signedIn') return <Redirect href="/sign-in" />;
  const home = {
    student: '/home',
    professor: '/staff/status',
    admin: '/admin/overview',
  } as const;
  return <Redirect href={home[state.user.role]} />;
}
