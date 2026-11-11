/**
 * Short confirmations ("Booked with Dr. Noura, Sunday 10:30"). Announced politely to
 * screen readers: a live region on Android and the web, announceForAccessibility on iOS.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { durations, radii, space } from '@/theme/tokens';
import { Text } from './Text';

const VISIBLE_MS = 4000;

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(next);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + space.lg }]}>
        {message && (
          <Animated.View
            entering={FadeIn.duration(durations.small)}
            exiting={FadeOut.duration(durations.small)}
            accessibilityLiveRegion="polite"
            role="status"
            style={[styles.toast, { backgroundColor: colors.text, boxShadow: shadow }]}
          >
            <Text variant="label" style={{ color: colors.bg }}>
              {message}
            </Text>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', start: space.md, end: space.md, alignItems: 'center' },
  toast: {
    borderRadius: radii.card,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    maxWidth: 560,
  },
});
