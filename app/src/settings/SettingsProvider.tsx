/**
 * Per-device settings (DESIGN.md 7.9), saved with the other preferences:
 * - text size: default, large or larger, multiplying the phone's own font size; the total
 *   stays at most 200% (Text divides its maxFontSizeMultiplier by this factor);
 * - which in-app notifications to show (appointments, messages). Kept on the device rather
 *   than in the database: it only filters what this phone shows (no push, CLAUDE.md Section 3).
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

import type { NotificationType } from '@/api/types';
import { preferenceKeys, readPreference, writePreference } from '@/lib/storage';

export const TEXT_SIZES = { default: 1, large: 1.15, larger: 1.3 } as const;
export type TextSize = keyof typeof TEXT_SIZES;

export interface NotificationPrefs {
  appointments: boolean;
  messages: boolean;
}

interface SettingsValue {
  textSize: TextSize;
  textScale: number;
  setTextSize: (size: TextSize) => void;
  notifications: NotificationPrefs;
  setNotifications: (prefs: NotificationPrefs) => void;
}

const DEFAULT_PREFS: NotificationPrefs = { appointments: true, messages: true };

const SettingsContext = createContext<SettingsValue>({
  textSize: 'default',
  textScale: 1,
  setTextSize: () => undefined,
  notifications: DEFAULT_PREFS,
  setNotifications: () => undefined,
});

/** Whether a notification of this type is shown under the current preferences. */
export function wantsNotification(prefs: NotificationPrefs, type: NotificationType): boolean {
  return type === 'new_message' ? prefs.messages : prefs.appointments;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>('default');
  const [notifications, setNotificationsState] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    readPreference(preferenceKeys.textSize).then((stored) => {
      if (stored && stored in TEXT_SIZES) setTextSizeState(stored as TextSize);
    });
    readPreference(preferenceKeys.notifications).then((stored) => {
      try {
        if (stored) setNotificationsState({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      } catch {
        // Unreadable: keep the defaults.
      }
    });
  }, []);

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    writePreference(preferenceKeys.textSize, size);
  }, []);
  const setNotifications = useCallback((prefs: NotificationPrefs) => {
    setNotificationsState(prefs);
    writePreference(preferenceKeys.notifications, JSON.stringify(prefs));
  }, []);

  const value = useMemo(
    () => ({
      textSize,
      textScale: TEXT_SIZES[textSize],
      setTextSize,
      notifications,
      setNotifications,
    }),
    [textSize, setTextSize, notifications, setNotifications],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  return useContext(SettingsContext);
}
