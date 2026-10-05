/**
 * The one way the app talks to the API.
 *
 * - The access token (15 min) lives only in memory here.
 * - A 401 triggers one refresh (shared by concurrent requests) and one retry. If the API rejects
 *   the refresh token, the session is over and the sign-out handler runs; a network failure
 *   during refresh is just "offline" and keeps the user signed in.
 * - Errors arrive as ApiError with the API's { error: { code, message } } code; status 0 and
 *   code NETWORK mean the server could not be reached.
 */
import { Platform } from 'react-native';

import { apiUrl } from '@/lib/apiUrl';
import { refreshTokenStore } from '@/auth/tokenStore';
import type { SignUpBody, TokenResponse } from './types';

const TIMEOUT_MS = 12_000;
const isWeb = Platform.OS === 'web';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const isNetworkError = (error: unknown) => error instanceof ApiError && error.status === 0;

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<TokenResponse> | null = null;

/** Called by the auth provider so an expired session signs the user out everywhere. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export function hasAccessToken() {
  return accessToken !== null;
}

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Required with the web refresh cookie (CSRF check, docs/security.md); harmless elsewhere.
    'X-Requested-With': 'mawjood',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${apiUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // The web build's refresh cookie only travels with credentials included.
      credentials: isWeb ? 'include' : 'omit',
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'The server could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : `HTTP_${response.status}`,
      typeof error?.message === 'string' ? error.message : response.statusText,
    );
  }
  return body as T;
}

async function acceptTokens(tokens: TokenResponse) {
  accessToken = tokens.access_token;
  if (tokens.refresh_token) await refreshTokenStore.write(tokens.refresh_token);
}

/** Exchange the stored refresh token (native) or cookie (web) for a new access token. */
export function refreshSession(): Promise<TokenResponse> {
  refreshing ??= (async () => {
    const stored = await refreshTokenStore.read();
    if (!isWeb && !stored) throw new ApiError(401, 'UNAUTHORIZED', 'Not signed in.');
    const tokens = await parse<TokenResponse>(
      await send('/auth/refresh', 'POST', isWeb ? {} : { refresh_token: stored }),
    );
    await acceptTokens(tokens);
    return tokens;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function endSession() {
  accessToken = null;
  await refreshTokenStore.clear();
  onSessionExpired?.();
}

/** An authenticated API call. Paths are relative to /api/v1. */
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response = await send(path, method, body);
  if (response.status === 401) {
    try {
      await refreshSession();
    } catch (error) {
      if (!isNetworkError(error)) await endSession();
      throw error;
    }
    response = await send(path, method, body);
  }
  return parse<T>(response);
}

export async function signInRequest(email: string, password: string): Promise<TokenResponse> {
  const tokens = await parse<TokenResponse>(
    await send('/auth/login', 'POST', { email, password, client: isWeb ? 'web' : 'native' }),
  );
  await acceptTokens(tokens);
  return tokens;
}

/** Students are signed in at once; a professor's account waits for an admin (HTTP 202). */
export async function signUpRequest(
  body: SignUpBody,
): Promise<{ kind: 'signedIn'; tokens: TokenResponse } | { kind: 'pending' }> {
  const response = await send('/auth/signup', 'POST', {
    ...body,
    client: isWeb ? 'web' : 'native',
  });
  if (response.status === 202) {
    await parse<unknown>(response);
    return { kind: 'pending' };
  }
  const tokens = await parse<TokenResponse>(response);
  await acceptTokens(tokens);
  return { kind: 'signedIn', tokens };
}

/** Forget the tokens here and, best effort, the web cookie on the server. */
export async function signOutRequest(): Promise<void> {
  try {
    if (isWeb) await send('/auth/logout', 'POST');
  } catch {
    // Offline: the cookie expires on its own; the local session is cleared anyway.
  }
  accessToken = null;
  await refreshTokenStore.clear();
}
