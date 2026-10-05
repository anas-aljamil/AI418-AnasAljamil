import AsyncStorage from '@react-native-async-storage/async-storage';

/** Per-device preferences (language, theme). Failures fall back to defaults instead of crashing. */
export const preferenceKeys = {
  language: 'mawjood.language',
  theme: 'mawjood.theme',
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
