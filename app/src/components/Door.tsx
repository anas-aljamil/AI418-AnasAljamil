/**
 * The status door: the app's signature (DESIGN.md Section 2; chosen design in Section 11).
 *
 * A square doorway on a 24-unit grid, drawn as solid shapes and lit from inside:
 *   in_office  leaf swung open (a hinge-side trapezoid), lamp light in the doorway and on the floor
 *   busy       leaf nearly closed, a glowing seam at the latch side, a no-entry bar
 *   in_class   closed, with an open-book mark
 *   away       closed and dark, with a knob
 *   unknown    dashed outline on a solid floor line ("not confirmed")
 * The leaf animates between closed, ajar and open (320 ms opening, 300 ms closing) and the
 * lamp fades with it. Colours are plain props that switch with the movement: on the web build
 * Reanimated does not apply animated SVG colour props (verified in e2e), so only geometry and
 * light opacity are animated. Reduced motion swaps instantly.
 * The hinge sits on the start edge, so the drawing mirrors in right-to-left layouts.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { durations, type StatusKey } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Leaf position: 0 closed, 1 ajar, 2 open. */
const LEAF: Record<StatusKey, number> = { away: 0, in_class: 0, unknown: 0, busy: 1, in_office: 2 };
const DOORWAY = 'M6 21V5a.8.8 0 0 1 .8-.8h10.4a.8.8 0 0 1 .8.8V21Z';
const BOOK =
  'M8.8 10.8c1-.6 2.2-.6 3.2 0c1-.6 2.2-.6 3.2 0v4c-1-.6-2.2-.6-3.2 0c-1-.6-2.2-.6-3.2 0Z';

interface DoorProps {
  status: StatusKey;
  size?: number;
  /** When set, the door is announced on its own; leave unset when a text label sits beside it. */
  accessibilityLabel?: string;
}

export function Door({ status, size = 24, accessibilityLabel }: DoorProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const color = colors.status[status];

  const leaf = useSharedValue(LEAF[status]);
  const lit = useSharedValue(LEAF[status] > 0 ? 1 : 0);

  useEffect(() => {
    const target = LEAF[status];
    const opening = target > leaf.value;
    const duration = reduceMotion ? 0 : opening ? durations.doorOpen : durations.doorClose;
    const easing = opening ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);
    leaf.set(withTiming(target, { duration, easing }));
    lit.set(withTiming(target > 0 ? 1 : 0, { duration: reduceMotion ? 0 : durations.small }));
  }, [status, reduceMotion, leaf, lit]);

  // Leaf outline: hinge on the start edge (x = 6); the latch corners move toward it.
  const leafProps = useAnimatedProps(() => {
    const x = interpolate(leaf.value, [0, 1, 2], [18, 16.4, 10.2]);
    const top = interpolate(leaf.value, [0, 1, 2], [4.2, 4.2, 6]);
    const bottom = interpolate(leaf.value, [0, 1, 2], [21, 21, 19.8]);
    return { d: `M6 4.2L${x} ${top}V${bottom}L6 21Z` };
  });
  const lampProps = useAnimatedProps(() => ({ fillOpacity: lit.value }));
  const floorProps = useAnimatedProps(() => ({
    fillOpacity: interpolate(leaf.value, [1, 2], [0, 0.8], 'clamp'),
  }));

  const dashed = status === 'unknown';
  // SVG coordinates do not follow layout direction, so the drawing is mirrored for Arabic
  // (I18nManager.isRTL is always false on the web build, so the UI language decides).
  const mirror = i18n.language === 'ar' ? { transform: [{ scaleX: -1 }] } : undefined;

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[{ width: size, height: size }, mirror]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Light on the floor, then the lit doorway behind the leaf. */}
        <AnimatedPath
          d="M6.5 22.1c2.5-.9 8.5-.9 11 0l.9 1.3H5.6Z"
          fill={colors.lamp}
          animatedProps={floorProps}
        />
        {!dashed && <AnimatedPath d={DOORWAY} fill={colors.lamp} animatedProps={lampProps} />}
        {dashed ? (
          <Path
            d="M6 21V4.2h12V21"
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeDasharray="2 2.15"
            strokeLinecap="round"
          />
        ) : (
          <>
            <AnimatedPath fill={color} animatedProps={leafProps} />
            <Path
              d={DOORWAY}
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeLinejoin="round"
            />
          </>
        )}
        {status === 'in_class' && (
          <Path
            d={BOOK}
            fill="none"
            stroke={colors.surface}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        )}
        {status === 'busy' && (
          <Rect x={8.5} y={11.5} width={5.4} height={2} rx={1} fill={colors.surface} />
        )}
        {status === 'away' && (
          <Path d="M16 13a1 1 0 1 1-2 0a1 1 0 0 1 2 0Z" fill={colors.surface} />
        )}
        <Path d="M3.5 21h17" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
