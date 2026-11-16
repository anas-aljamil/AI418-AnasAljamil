/**
 * An appointment as a ticket (DESIGN.md Section 11, "The corridor"): the time at the start
 * edge, a dashed fold with a notch, then who and where. Actions, when there are any, sit
 * under the ticket's two parts.
 */
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';

const NOTCH = 14;

interface TicketProps extends Omit<ViewProps, 'children' | 'style'> {
  /** The start part: the time, large, and the day under it. */
  stub: React.ReactNode;
  /** The main part: who, where and the state. */
  children: React.ReactNode;
  /** Buttons under both parts (Approve, Cancel ...). */
  footer?: React.ReactNode;
}

export function Ticket({ stub, children, footer, ...rest }: TicketProps) {
  const { colors } = useTheme();
  // The notches are cut out of the ticket: they take the page colour and the ticket's edge.
  const notch = { backgroundColor: colors.bg, borderColor: colors.line };
  return (
    <View
      style={[styles.ticket, { backgroundColor: colors.surface, borderColor: colors.line }]}
      {...rest}
    >
      <View style={styles.parts}>
        <View style={styles.stub}>{stub}</View>
        <View style={styles.fold}>
          <View style={[styles.notch, styles.notchTop, notch]} />
          <View
            style={[
              styles.foldLine,
              { borderColor: colors.line },
              footer ? styles.foldLineOpen : null,
            ]}
          />
          {/* With buttons below, the fold ends above them and has no lower notch. */}
          {footer ? null : <View style={[styles.notch, styles.notchBottom, notch]} />}
        </View>
        <View style={styles.main}>{children}</View>
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  parts: { flexDirection: 'row' },
  // The time never squeezes the name: at large text sizes it wraps inside its own part.
  stub: { padding: space.md, justifyContent: 'center', gap: 2, maxWidth: '40%' },
  main: { flex: 1, padding: space.md, gap: space.xxs },
  fold: { width: NOTCH, alignItems: 'center' },
  foldLine: { flex: 1, borderStartWidth: 1.5, borderStyle: 'dashed', marginVertical: NOTCH / 2 },
  foldLineOpen: { marginBottom: 0 },
  notch: {
    position: 'absolute',
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  footer: { paddingHorizontal: space.md, paddingBottom: space.md },
});
