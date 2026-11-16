/**
 * "Skip to content", for keyboard users on the desktop browser layout: the first Tab stop of
 * the page. It is invisible until it has the focus; pressing it moves the focus to the open
 * screen's heading, past the side rail's links. Phones and tablets have no rail to skip.
 * It is a button, not a link: it has no address to go to, and React Native Web presses a button
 * on Enter but not a link without one.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { insetStart } from '@/lib/direction';
import { useLayout } from '@/lib/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget, type Language } from '@/theme/tokens';
import { Text } from './Text';

/** Moves the keyboard focus to the first heading of the screen that is showing. */
function focusContent() {
  // React Native Web writes a heading with a level as h1 or h2, one without as role="heading".
  const heading = [...document.querySelectorAll<HTMLElement>('h1, h2, [role="heading"]')].find(
    (el) => el.checkVisibility(),
  );
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}

export function SkipLink() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const desktop = useLayout() === 'desktop';
  const [focused, setFocused] = useState(false);
  if (Platform.OS !== 'web' || !desktop) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={focusContent}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.link,
        insetStart(space.sm, language),
        // Unseen, it must not take a click meant for the logo under it.
        { backgroundColor: colors.primary, opacity: focused ? 1 : 0 },
        focused ? null : styles.unseen,
      ]}
    >
      <Text variant="label" color="onPrimary">
        {t('nav.skip')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  unseen: { pointerEvents: 'none' },
  link: {
    position: 'absolute',
    top: space.sm,
    zIndex: 10,
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radii.input,
  },
});
