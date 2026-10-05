/**
 * Where the refresh token lives (CLAUDE.md Section 8):
 * - Android/iOS: expo-secure-store (Keychain / Keystore), sent to the API in the request body;
 * - web build: an httpOnly cookie set by the API, which this code never sees, so nothing is stored.
 * The short-lived access token is never stored; it lives in memory in src/api/client.ts.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'mawjood.refresh';
const native = Platform.OS !== 'web';

export const refreshTokenStore = {
  async read(): Promise<string | null> {
    if (!native) return null;
    try {
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async write(token: string): Promise<void> {
    if (!native) return;
    try {
      await SecureStore.setItemAsync(KEY, token);
    } catch {
      // Not saved: the user stays signed in for this session only.
    }
  },
  async clear(): Promise<void> {
    if (!native) return;
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Nothing stored.
    }
  },
};
