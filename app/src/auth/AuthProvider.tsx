/**
 * Who is signed in. A saved session (refresh token in the secure store on native, cookie on
 * web, plus the cached public profile) opens straight to the signed-in screens with the last
 * known data, then is confirmed with the server in the background. If the server is
 * unreachable the user stays signed in and the API calls catch up once the connection returns
 * (DESIGN.md Section 9, offline); if the server rejects the session, the user is signed out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import {
  isNetworkError,
  refreshSession,
  setSessionExpiredHandler,
  signInRequest,
  signOutRequest,
  signUpRequest,
} from '@/api/client';
import { clearCachedData } from '@/api/queryClient';
import { refreshTokenStore } from '@/auth/tokenStore';
import type { Me, SignUpBody } from '@/api/types';
import { preferenceKeys, readPreference, removePreference, writePreference } from '@/lib/storage';

type AuthState =
  | { status: 'restoring'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: Me };

interface AuthValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<Me>;
  /** 'signedIn' for students; 'pending' when a professor's account waits for an admin. */
  signUp: (body: SignUpBody) => Promise<'signedIn' | 'pending'>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function readCachedUser(): Promise<Me | null> {
  try {
    const raw = await readPreference(preferenceKeys.user);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'restoring', user: null });

  const signedIn = useCallback((user: Me) => {
    writePreference(preferenceKeys.user, JSON.stringify(user));
    setState({ status: 'signedIn', user });
  }, []);

  const forget = useCallback(async () => {
    await Promise.all([clearCachedData(), removePreference(preferenceKeys.user)]);
    setState({ status: 'signedOut', user: null });
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => void forget());
    let cancelled = false;
    (async () => {
      // A saved session opens at once with the cached profile (fast start, works offline);
      // the refresh below then confirms it, or signs out if the server rejects it.
      const cached = await readCachedUser();
      const hasToken = Platform.OS === 'web' || (await refreshTokenStore.read()) !== null;
      if (!cached || !hasToken) {
        if (!cancelled) await forget();
        return;
      }
      if (!cancelled) setState({ status: 'signedIn', user: cached });
      try {
        const tokens = await refreshSession();
        if (!cancelled) signedIn(tokens.user);
      } catch (error) {
        if (!cancelled && !isNetworkError(error)) await forget();
      }
    })();
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, [forget, signedIn]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await signInRequest(email.trim().toLowerCase(), password);
      signedIn(tokens.user);
      return tokens.user;
    },
    [signedIn],
  );

  const signUp = useCallback(
    async (body: SignUpBody) => {
      const result = await signUpRequest(body);
      if (result.kind === 'pending') return 'pending' as const;
      signedIn(result.tokens.user);
      return 'signedIn' as const;
    },
    [signedIn],
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    await forget();
  }, [forget]);

  const value = useMemo(
    () => ({ state, signIn, signUp, signOut }),
    [state, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** The signed-in user; only for screens behind the signed-in layout. */
export function useUser(): Me {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useUser needs a signed-in user');
  return state.user;
}
