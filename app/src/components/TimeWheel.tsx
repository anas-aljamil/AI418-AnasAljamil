/**
 * The booking start as two wheels, hours and minutes, like the phone's own alarm picker
 * (owner request 2026-11-18, with a screenshot of the iPhone's "Edit Alarm"). The time in the
 * band across the middle is the chosen one: scroll a wheel and it settles on a row, or tap a
 * row. The hour carries its period ("10 AM", "10 ص"), so there is no third wheel; minutes go
 * in 5-minute steps. Booked and past starts stay on the wheel, dimmed and struck through, and
 * a wheel that stops on one moves on to the nearest free start; their names say why
 * ("10:15 AM, booked").
 *
 * Better than the alarm wheel for everyone else: each wheel is a radio group, so a screen
 * reader or the keyboard picks a row directly instead of having to spin.
 *
 * Snapping: Android and iOS snap natively (snapToInterval); the browser build snaps with CSS
 * scroll snapping, which react-native-web does not map from snapToInterval. Either way the row
 * is read once scrolling has stopped.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Slot } from '@/api/types';
import { clockText, hourText } from '@/lib/format';
import { useTextFactor } from '@/settings/SettingsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget } from '@/theme/tokens';
import { Text } from './Text';

/** How long after the last scroll event a wheel counts as stopped. */
const SETTLE_MS = 140;

interface WheelItem {
  key: string;
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
}

interface WheelProps {
  label: string;
  items: WheelItem[];
  selected: string | null;
  onSelect: (key: string) => void;
  row: number;
  rows: number;
}

/** The nearest row from `from` that can be chosen, looking both ways; null when none. */
function nearestFree(items: WheelItem[], from: number): number | null {
  for (let step = 0; step < items.length; step += 1) {
    for (const index of [from + step, from - step]) {
      if (items[index] && !items[index].disabled) return index;
    }
  }
  return null;
}

// CSS scroll snapping for the browser build (not in React Native's style types).
const webSnap = Platform.select({ web: { scrollSnapType: 'y mandatory' } as unknown as ViewStyle });
const webSnapItem = Platform.select({ web: { scrollSnapAlign: 'center' } as unknown as ViewStyle });

function Wheel({ label, items, selected, onSelect, row, rows }: WheelProps) {
  const scroller = useRef<ScrollViewInstance>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the wheel was last put or left, so a scroll the code made is not read as a choice.
  const shown = useRef<number | null>(null);
  const index = Math.max(
    0,
    items.findIndex((item) => item.key === selected),
  );

  // Keep the chosen row in the band: after a tap, another hour, or a new day's times.
  useEffect(() => {
    const y = index * row;
    if (shown.current !== y) {
      scroller.current?.scrollTo({ y, animated: shown.current !== null });
      shown.current = y;
    }
  }, [index, row, items]);
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const land = (y: number) => {
    const target = nearestFree(items, Math.min(items.length - 1, Math.max(0, Math.round(y / row))));
    if (target === null) return;
    shown.current = y;
    if (target * row !== y) {
      scroller.current?.scrollTo({ y: target * row, animated: true });
      shown.current = target * row;
    }
    if (items[target]!.key !== selected) onSelect(items[target]!.key);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => land(y), SETTLE_MS);
  };

  const padding = row * Math.floor(rows / 2);
  return (
    <View role="radiogroup" aria-label={label} style={styles.wheel}>
      <ScrollView
        ref={scroller}
        style={[{ height: row * rows }, webSnap]}
        contentContainerStyle={{ paddingVertical: padding }}
        showsVerticalScrollIndicator={false}
        snapToInterval={row}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {items.map((item, i) => {
          const chosen = i === index;
          return (
            <Pressable
              key={item.key}
              role="radio"
              aria-checked={chosen}
              aria-disabled={item.disabled}
              accessibilityLabel={item.accessibilityLabel}
              onPress={() => {
                if (!item.disabled) onSelect(item.key);
              }}
              style={[styles.item, { height: row }, webSnapItem]}
            >
              <Text
                variant="title"
                weight={chosen ? 'semibold' : 'regular'}
                color={chosen && !item.disabled ? 'text' : 'muted'}
                style={item.disabled ? styles.unavailable : null}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface TimeWheelProps {
  /** The day's starts, every 5 minutes, as the API lists them. */
  slots: Slot[];
  /** The chosen start (starts_at), or null. */
  value: string | null;
  onChange: (startsAt: string) => void;
}

export function TimeWheel({ slots, value, onChange }: TimeWheelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const factor = useTextFactor();
  // Rows grow with the text; at very large text the wheel shows 3 rows instead of 5.
  const row = Math.round(touchTarget * Math.max(1, factor * 0.9));
  const rows = factor > 1.5 ? 3 : 5;

  const chosen = slots.find((slot) => slot.starts_at === value) ?? null;
  const hourOf = (slot: Slot) => slot.local_time.slice(0, 2);
  const currentHour = chosen ? hourOf(chosen) : slots[0] ? hourOf(slots[0]) : null;

  const hours = useMemo<WheelItem[]>(() => {
    const seen = new Map<string, boolean>();
    for (const slot of slots)
      seen.set(hourOf(slot), (seen.get(hourOf(slot)) ?? false) || slot.available);
    return [...seen].map(([hour, free]) => {
      const text = hourText(Number(hour), t);
      return {
        key: hour,
        label: text,
        accessibilityLabel: free ? text : t('booking.hour_full', { hour: text }),
        disabled: !free,
      };
    });
  }, [slots, t]);

  const minutes = useMemo<WheelItem[]>(
    () =>
      slots
        .filter((slot) => hourOf(slot) === currentHour)
        .map((slot) => {
          const time = clockText(slot.local_time, t);
          return {
            key: slot.starts_at,
            label: slot.local_time.slice(3, 5),
            accessibilityLabel: slot.available
              ? time
              : t(slot.reason === 'past' ? 'booking.option_past' : 'booking.option_taken', {
                  time,
                }),
            disabled: !slot.available,
          };
        }),
    [slots, currentHour, t],
  );

  // A new hour keeps the minutes if that start is free, else takes the hour's first free one.
  const chooseHour = (hour: string) => {
    const inHour = slots.filter((slot) => hourOf(slot) === hour);
    const sameMinute =
      chosen &&
      inHour.find((slot) => slot.local_time.slice(3, 5) === chosen.local_time.slice(3, 5));
    const next = sameMinute?.available ? sameMinute : inHour.find((slot) => slot.available);
    if (next) onChange(next.starts_at);
  };

  const band = row * Math.floor(rows / 2);
  return (
    <View style={styles.frame}>
      {/* The band behind both wheels; the rows inside it are the chosen time. */}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          { top: band, height: row, backgroundColor: colors.tint, borderColor: colors.line },
        ]}
      />
      <View style={styles.wheels}>
        <Wheel
          label={t('booking.wheel_hour')}
          items={hours}
          selected={currentHour}
          onSelect={chooseHour}
          row={row}
          rows={rows}
        />
        <Wheel
          label={t('booking.wheel_minutes')}
          items={minutes}
          selected={chosen?.starts_at ?? null}
          onSelect={onChange}
          row={row}
          rows={rows}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  wheel: { flexGrow: 0, minWidth: touchTarget * 2 },
  item: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  unavailable: { textDecorationLine: 'line-through' },
});
