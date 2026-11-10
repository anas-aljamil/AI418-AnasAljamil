/**
 * Bottom sheet on phones (booking, presets). Built on Modal so that:
 * - screen readers stay inside it (accessibilityViewIsModal),
 * - the Android back button closes it first (onRequestClose),
 * - it springs in (about 350 ms) and eases out; reduced motion shows it instantly.
 * A visible Close button is always present; there is no gesture-only dismissal.
 * On desktop (1024 px and up) the same sheet is a centred dialog that fades in and rises a
 * little (DESIGN.md 7.5; docs/desktop-plan.md, Section 3); Escape closes it (onRequestClose).
 * Inside <InlineSheets> (a desktop end pane, e.g. the admin form) the sheet is drawn in place as
 * a panel instead; sheets opened from inside it (confirmations, menus) are dialogs again.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { layoutDirection } from '@/lib/direction';
import { useLayout } from '@/lib/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { durations, layout, radii, space } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const InlineSheetContext = createContext(false);

/** Sheets directly inside are drawn in place (a desktop pane) instead of over the screen. */
export function InlineSheets({ children }: { children: React.ReactNode }) {
  return <InlineSheetContext.Provider value>{children}</InlineSheetContext.Provider>;
}

const OFFSCREEN = 600;
// The dialog rises this far while it fades in, instead of sliding up from the bottom edge.
const DIALOG_RISE = space.lg / OFFSCREEN;

export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const { colors, shadow } = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const dialog = useLayout() === 'desktop';
  const inline = useContext(InlineSheetContext);
  // Stays true while the closing animation runs; set during render when the sheet opens
  // (React's "adjust state while rendering" pattern) and cleared when the animation ends.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const offset = useSharedValue(OFFSCREEN);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      offset.set(reduceMotion ? 0 : withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 }));
      scrim.set(withTiming(1, { duration: reduceMotion ? 0 : durations.small }));
    } else {
      scrim.set(withTiming(0, { duration: reduceMotion ? 0 : durations.small }));
      offset.set(
        withTiming(
          OFFSCREEN,
          { duration: reduceMotion ? 0 : durations.sheet, easing: Easing.in(Easing.cubic) },
          (done) => {
            if (done) runOnJS(setMounted)(false);
          },
        ),
      );
    }
  }, [visible, reduceMotion, offset, scrim]);

  const sheetStyle = useAnimatedStyle(() =>
    dialog
      ? { opacity: scrim.value, transform: [{ translateY: offset.value * DIALOG_RISE }] }
      : { transform: [{ translateY: offset.value }] },
  );
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  if (inline) {
    if (!visible) return null;
    return (
      <InlineSheetContext.Provider value={false}>
        <View role="region" aria-label={title} style={styles.panel}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          <Button label={t('common.close')} variant="quiet" onPress={onClose} />
        </View>
      </InlineSheetContext.Provider>
    );
  }

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* A modal starts a new layout root, so it takes the reading direction again. */}
      <View
        style={[
          styles.root,
          dialog && styles.dialogRoot,
          layoutDirection(i18n.language === 'ar' ? 'ar' : 'en'),
        ]}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            accessibilityViewIsModal
            aria-modal
            role="dialog"
            aria-label={title}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                boxShadow: shadow,
                paddingBottom: insets.bottom + space.md,
                maxHeight: height * 0.92,
              },
              dialog && [styles.dialog, { maxHeight: height * layout.dialogHeight }],
              sheetStyle,
            ]}
          >
            {!dialog && <View style={[styles.grabber, { backgroundColor: colors.line }]} />}
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {/* Long content (the booking sheet) scrolls; the title and Close stay in place. */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            <Button label={t('common.close')} variant="quiet" onPress={onClose} />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dialogRoot: { justifyContent: 'center', padding: space.lg },
  sheet: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    gap: space.sm,
    maxWidth: layout.dialog,
    width: '100%',
    alignSelf: 'center',
  },
  dialog: { borderRadius: radii.sheet, paddingTop: space.md, paddingBottom: space.md },
  body: { flexShrink: 1 },
  panel: { flex: 1, padding: space.lg, gap: space.sm },
  bodyContent: { gap: space.sm },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    alignSelf: 'center',
    marginBottom: space.xs,
  },
});
