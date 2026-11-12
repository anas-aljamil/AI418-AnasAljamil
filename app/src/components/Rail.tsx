/**
 * The thin coloured bar beside a timetable row. With a colour-vision setting (owner request
 * 2026-11-11) the bar also carries a pattern, so kinds differ without colour: solid (office
 * hours, booking times), dashed (classes, closed message hours) or dotted (meetings).
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export type RailPattern = 'solid' | 'dashed' | 'dotted';

// Enough pieces for a tall row; the rail clips what does not fit.
const PIECES = Array.from({ length: 40 }, (_, i) => i);

export function Rail({ color, pattern = 'solid' }: { color: string; pattern?: RailPattern }) {
  const { colorVision } = useTheme();
  const shown = colorVision === 'normal' ? 'solid' : pattern;
  if (shown === 'solid') return <View style={[styles.rail, { backgroundColor: color }]} />;
  // The pieces sit in an absolute layer, so they never make the row taller than its text.
  return (
    <View style={styles.rail}>
      <View style={[StyleSheet.absoluteFill, styles.pieces]}>
        {PIECES.map((i) => (
          <View
            key={i}
            style={[shown === 'dashed' ? styles.dash : styles.dot, { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

const RAIL = space.xxs;

const styles = StyleSheet.create({
  rail: { width: RAIL, alignSelf: 'stretch', borderRadius: RAIL / 2 },
  pieces: { overflow: 'hidden', gap: RAIL, alignItems: 'center' },
  dash: { width: RAIL, height: space.xs + RAIL / 2, borderRadius: RAIL / 2 },
  dot: { width: RAIL, height: RAIL, borderRadius: RAIL / 2 },
});
