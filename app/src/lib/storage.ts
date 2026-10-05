import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-device values that are not secret: preferences (language, theme) and the signed-in
 * user's public profile (name, role), so the app can open offline. Tokens never go here
 * (see src/auth/tokenStore.ts). Failures fall back to defaults instead of crashing.
 */
export const preferenceKeys = {
  language: 'mawjood.language',
  theme: 'mawjood.theme',
  user: 'mawjood.user',
} as const;

export async function readPreference(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writePreference(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Not saved: the choice still applies for this session.
  }
}

export async function removePreference(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing saved.
  }
}
