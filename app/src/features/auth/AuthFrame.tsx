/**
 * The frame of the screens before sign-in (DESIGN.md 7.1 and Section 11, "The corridor"): the
 * navy band with the app's name, one tall door and the screen's heading, then the form.
 * The door is lit on sign-in and sign-up: the app's promise in one picture.
 *
 * Phones and tablets: the band on top, the form under it. Desktop: the band fills the start
 * half of the window, the form sits in the other half.
 */
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/AppBar';
import { Band } from '@/components/Corridor';
import { TallDoor } from '@/components/TallDoor';
import { Text } from '@/components/Text';
import { useColumn, useLayout } from '@/lib/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space, type StatusKey } from '@/theme/tokens';

interface AuthFrameProps {
  title: string;
  subtitle?: string;
  /** The door on the band: lit by default; closed while a professor's account waits. */
  door?: StatusKey;
  /** Sits at the end of the app bar (the language button on sign-in). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthFrame({
  title,
  subtitle,
  door = 'in_office',
  action,
  children,
}: AuthFrameProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn('narrow');
  const desktop = useLayout() === 'desktop';

  const band = (
    <Band style={[desktop ? styles.side : styles.top, { paddingTop: insets.top + space.sm }]}>
      <View style={[styles.bandInner, desktop ? styles.fill : column]}>
        <AppBar onBand>{action}</AppBar>
        <View style={desktop ? styles.heroSide : styles.hero}>
          <TallDoor status={door} size={desktop ? 132 : 64} onBand />
          <View style={desktop ? styles.heroTextSide : styles.heroText}>
            <Text variant={desktop ? 'display' : 'heading'} role="heading" color="onBand">
              {title}
            </Text>
            {subtitle ? <Text color="onBandMuted">{subtitle}</Text> : null}
          </View>
        </View>
      </View>
    </Band>
  );

  const form = (
    <View
      style={[
        styles.form,
        desktop ? styles.formSide : column,
        { paddingBottom: insets.bottom + space.lg },
      ]}
    >
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {desktop ? (
        <View style={styles.row}>
          {band}
          <ScrollView
            style={styles.fill}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sideScroll}
          >
            {form}
          </ScrollView>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
          {band}
          {form}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1 },
  row: { flex: 1, flexDirection: 'row' },
  top: { paddingHorizontal: space.md, paddingBottom: space.lg },
  side: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
  bandInner: { gap: space.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroText: { flex: 1, gap: space.xxs },
  heroSide: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', gap: space.lg },
  heroTextSide: { gap: space.xs, maxWidth: layout.narrowColumn },
  form: { flexGrow: 1, paddingHorizontal: space.md, paddingTop: space.lg, gap: space.lg },
  // Beside the band the form is as tall as its fields and sits in the middle of its half.
  formSide: { flexGrow: 0, width: '100%', maxWidth: layout.narrowColumn, alignSelf: 'center' },
  sideScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space.xl },
});
