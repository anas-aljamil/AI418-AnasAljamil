/**
 * For screens outside the role tabs (a professor's profile, a conversation, notifications):
 * a visitor who is not signed in goes to sign-in and comes back here afterwards. The role
 * tabs have the same rule in their layouts. Without it these screens were blank pages.
 */
import { Redirect, usePathname, type Href } from 'expo-router';

import { signInHref } from '@/lib/nav';
import { useAuth } from './AuthProvider';

export function RequireSignIn({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  if (state.status !== 'signedIn') return <Redirect href={signInHref(pathname) as Href} />;
  return <>{children}</>;
}
