import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import { preferenceKeys, readPreference, writePreference } from '@/lib/storage';
import {
  COLOR_VISIONS,
  elevation,
  paletteFor,
  palettes,
  type ColorScheme,
  type ColorVision,
  type Palette,
} from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeValue {
  scheme: ColorScheme;
  colors: Palette;
  shadow: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Status colours for the viewer's colour vision (device setting, default normal). */
  colorVision: ColorVision;
  setColorVision: (vision: ColorVision) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function isPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [colorVision, setColorVisionState] = useState<ColorVision>('normal');

  useEffect(() => {
    readPreference(preferenceKeys.theme).then((stored) => {
      if (isPreference(stored)) setPreferenceState(stored);
    });
    readPreference(preferenceKeys.colorVision).then((stored) => {
      const known = COLOR_VISIONS.find((vision) => vision === stored);
      if (known) setColorVisionState(known);
    });
  }, []);

  const setColorVision = useCallback((next: ColorVision) => {
    setColorVisionState(next);
    writePreference(preferenceKeys.colorVision, next);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writePreference(preferenceKeys.theme, next);
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(
    () => ({
      scheme,
      colors: paletteFor(scheme, colorVision),
      shadow: elevation[scheme].floating,
      preference,
      setPreference,
      colorVision,
      setColorVision,
    }),
    [scheme, preference, setPreference, colorVision, setColorVision],
  );

  useEffect(() => {
    // The root view behind every screen matches the theme (no white flash in dark mode).
    SystemUI.setBackgroundColorAsync(palettes[scheme].bg).catch(() => undefined);
    // Web build: the browser's own parts (scrollbars, form autofill) follow the theme too.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = scheme;
    }
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
