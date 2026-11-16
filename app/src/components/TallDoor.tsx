/**
 * The tall status door (DESIGN.md Section 11, "The corridor"): the same door as Door.tsx, drawn
 * as a full doorway on a 64 x 96 grid (2:3) for the corridor on Home and the professor's own
 * status. Door.tsx stays the icon for 16 to 32 px.
 *   in_office  leaf swung open, the doorway lit, a pool of light on the floor
 *   busy       leaf nearly closed, a lit seam at the latch side, a no-entry bar
 *   in_class   closed, with an open-book mark
 *   away       closed and dark, with a knob
 *   unknown    dashed outline ("not confirmed")
 * It animates like the small door: only geometry and light opacity move (Reanimated does not
 * apply animated SVG colours on the web build), and reduced motion swaps instantly. The hinge
 * sits on the start edge, so the drawing mirrors in right-to-left layouts.
 */
import { useEffect, useId } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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
import { LEAF } from './Door';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// The doorway: x 14 to 50, y 6 to 80 (the floor), hinge at x = 14.
const FRAME = { x: 14, y: 6, width: 36, height: 74, rx: 2 };
const BOOK = 'M23 36c3-2 6-2 9 0c3-2 6-2 9 0v12c-3-2-6-2-9 0c-3-2-6-2-9 0ZM32 36v12';
const STROKE = 3;

interface TallDoorProps {
  status: StatusKey;
  /** Width; the height is one and a half times it. */
  size?: number;
  /** On the corridor band: band status colours, marks cut in the band colour. */
  onBand?: boolean;
  /** The floor line under the door (off in the corridor, which draws one line for all doors). */
  floor?: boolean;
  /** When set, the door is announced on its own; leave unset when a text label sits beside it. */
  accessibilityLabel?: string;
}

export function TallDoor({
  status,
  size = 72,
  onBand = false,
  floor = true,
  accessibilityLabel,
}: TallDoorProps) {
  const { colors, colorVision } = useTheme();
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const poolId = useId();
  // With a colour-vision setting the marks are bolder, so the shape carries more of the meaning.
  const bold = colorVision !== 'normal';
  const color = onBand ? colors.bandStatus[status] : colors.status[status];
  const ground = onBand ? colors.band : colors.surface;

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

  // Leaf outline: hinge on the start edge; the latch corners move toward it as it opens.
  const leafProps = useAnimatedProps(() => {
    const x = interpolate(leaf.value, [0, 1, 2], [50, 44, 27]);
    const top = interpolate(leaf.value, [0, 1, 2], [6, 6, 12]);
    const bottom = interpolate(leaf.value, [0, 1, 2], [80, 80, 75]);
    return { d: `M14 6L${x} ${top}V${bottom}L14 80Z` };
  });
  const lampProps = useAnimatedProps(() => ({ fillOpacity: lit.value }));
  const poolProps = useAnimatedProps(() => ({
    fillOpacity: interpolate(leaf.value, [1, 2], [0, 1], 'clamp'),
  }));

  const dashed = status === 'unknown';
  // SVG coordinates do not follow layout direction, so the drawing is mirrored for Arabic
  // (I18nManager.isRTL is always false on the web build, so the UI language decides).
  const mirror = i18n.language === 'ar' ? { transform: [{ scaleX: -1 }] } : undefined;
  const height = size * 1.5;

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[{ width: size, height }, mirror]}
    >
      <Svg width={size} height={height} viewBox="0 0 64 96">
        <Defs>
          <LinearGradient id={poolId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.lamp} stopOpacity={0.7} />
            <Stop offset="1" stopColor={colors.lamp} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Light spilling onto the floor, then the lit doorway behind the leaf. */}
        <AnimatedPath d="M14 80H50L62 96H2Z" fill={`url(#${poolId})`} animatedProps={poolProps} />
        {!dashed && <AnimatedRect {...FRAME} fill={colors.lamp} animatedProps={lampProps} />}
        {!dashed && <AnimatedPath fill={color} animatedProps={leafProps} />}
        <Rect
          {...FRAME}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={dashed ? '5 5.4' : undefined}
          strokeLinecap={dashed ? 'round' : undefined}
        />
        {status === 'in_class' && (
          <Path
            d={BOOK}
            fill="none"
            stroke={ground}
            strokeWidth={bold ? 3.4 : 2.4}
            strokeLinejoin="round"
          />
        )}
        {status === 'busy' && (
          <Rect
            x={bold ? 19 : 21}
            y={bold ? 37.5 : 39}
            width={bold ? 20 : 16}
            height={bold ? 9 : 6}
            rx={bold ? 4.5 : 3}
            fill={ground}
          />
        )}
        {status === 'away' && <Circle cx={43} cy={45} r={bold ? 3.8 : 2.8} fill={ground} />}
        {floor && <Path d="M5 80H59" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />}
      </Svg>
    </View>
  );
}
