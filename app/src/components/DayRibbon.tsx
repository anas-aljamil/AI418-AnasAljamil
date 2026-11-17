/**
 * The day ribbon (DESIGN.md Section 11): today as one line, from 8 AM to 5 PM or wider when a
 * block starts earlier or ends later. Office hours are a solid bar, classes are striped and
 * meetings dotted, so the kinds differ without colour; a mark shows where "now" is. Thin lines
 * cut the bar at every whole hour and the hour labels sit on those lines (2026-11-17, owner
 * request: "clearer and more precise"), every hour when there is room, else fewer. It is
 * the glance; the agenda (TodayTimeline) or the week's times say the same in words, and screen
 * readers get the ribbon as one sentence.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Block, BlockKind } from '@/api/types';
import { BLOCK_KINDS, BLOCK_STATUS, blockKindKey } from '@/lib/blocks';
import { insetStart, textAlignFor } from '@/lib/direction';
import { clockText, hourText, minutesOfDay } from '@/lib/format';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Text } from './Text';

const DAY_START = 8 * 60;
const DAY_END = 17 * 60;
const TRACK = 24;
const NOW_OVERHANG = 4;
const SEGMENT_RADIUS = 5;
const STRIPE = 3;
const DOT = 6;
// Hour labels are a guide beside the agenda's full times, so like tab labels they grow only a
// little with the text size and never run into each other.
const AXIS_SCALE = 1.3;
const OUTLINE = 2;
const SWATCH = 28;
// Room for one hour label ("12 PM" at 130%), and the least room from one label to the next.
const LABEL = 48;
const LABEL_GAP = 52;
const LABEL_STEPS = [60, 120, 180, 240];

interface DayRibbonProps {
  blocks: Block[];
  /** Riyadh time now, "HH:MM"; null for a day that is not today (no mark). */
  now: string | null;
  /** On the corridor band: band colours. */
  onBand?: boolean;
  /** The names of the kinds shown, under the ribbon. */
  legend?: boolean;
  /** The hour labels under the bar (a week shows them once, as its own HourAxis row). */
  axis?: boolean;
  /** What a screen reader calls the day: "Today" by default, a weekday in a week. */
  dayName?: string;
  /** The minutes of the day the bar covers; a week passes one range so its days line up. */
  range?: [number, number];
}

/** Whole hours around some blocks, never narrower than the working day (08:00 to 16:00). */
export function ribbonRange(blocks: Block[]): [number, number] {
  return [
    Math.min(DAY_START, ...blocks.map((b) => Math.floor(minutesOfDay(b.start_time) / 60) * 60)),
    Math.max(DAY_END, ...blocks.map((b) => Math.ceil(minutesOfDay(b.end_time) / 60) * 60)),
  ];
}

export function DayRibbon({
  blocks,
  now,
  onBand = false,
  legend = true,
  axis = true,
  dayName,
  range,
}: DayRibbonProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const statusColors = onBand ? colors.bandStatus : colors.status;
  const ink = onBand ? colors.onBand : colors.text;
  const trackColor = onBand ? colors.bandRaised : colors.line;

  const sorted = [...blocks].sort(
    (a, b) => minutesOfDay(a.start_time) - minutesOfDay(b.start_time),
  );
  const [from, to] = range ?? ribbonRange(sorted);
  const span = to - from;
  const percent = (minutes: number): `${number}%` => `${((minutes - from) / span) * 100}%`;
  const width = (minutes: number): `${number}%` => `${(minutes / span) * 100}%`;

  const nowMinutes = now === null ? null : minutesOfDay(now);
  const nowShown = nowMinutes !== null && nowMinutes >= from && nowMinutes <= to;
  const kinds = BLOCK_KINDS.filter((kind) => sorted.some((block) => block.kind === kind));
  // Stripes and dots are drawn one by one, so each stretch needs its width in pixels.
  const [trackWidth, setTrackWidth] = useState(0);
  const hourLines: number[] = [];
  for (let at = from + 60; at < to; at += 60) hourLines.push(at);

  const spoken = spokenList(
    [
      dayName ?? t('prof.today'),
      ...sorted.map((block) =>
        spokenList(
          [
            t('prof.timeline_range', {
              start: clockText(block.start_time, t),
              end: clockText(block.end_time, t),
            }),
            t(blockKindKey(block.kind)),
          ],
          t,
        ),
      ),
      // A day of a week says it is free in its own name (WeekRibbons); only today needs this.
      sorted.length === 0 && !dayName ? t('prof.no_blocks') : null,
      now === null ? null : t('prof.now', { time: clockText(now, t) }),
    ],
    t,
  );

  return (
    <View style={styles.ribbon}>
      <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={styles.plot}>
        <View
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          testID="ribbon-track"
          style={[styles.track, { backgroundColor: trackColor }]}
        >
          {hourLines.map((at) => (
            <View
              key={at}
              style={[
                styles.hourLine,
                insetStart(percent(at), language),
                { backgroundColor: onBand ? colors.onBandMuted : colors.muted },
              ]}
            />
          ))}
          {sorted.map((block) => (
            <View
              key={block.block_id}
              style={[
                styles.segment,
                insetStart(percent(minutesOfDay(block.start_time)), language),
                {
                  width: width(minutesOfDay(block.end_time) - minutesOfDay(block.start_time)),
                  // The bar's own colour behind stripes and dots hides the hour lines there.
                  backgroundColor: trackColor,
                },
              ]}
            >
              <Fill
                kind={block.kind}
                color={statusColors[BLOCK_STATUS[block.kind]]}
                width={
                  (trackWidth * (minutesOfDay(block.end_time) - minutesOfDay(block.start_time))) /
                  span
                }
              />
            </View>
          ))}
        </View>
        {nowShown && nowMinutes !== null ? (
          <View
            style={[
              styles.now,
              insetStart(percent(nowMinutes), language),
              { backgroundColor: ink },
            ]}
          />
        ) : null}
      </View>
      {axis ? <HourAxis range={[from, to]} onBand={onBand} /> : null}
      {legend ? <RibbonLegend kinds={kinds} onBand={onBand} /> : null}
    </View>
  );
}

/**
 * The hour labels of a ribbon, each centred on its hour line (the first and last line up with
 * the bar's ends): every hour when there is room, else every two, three or four. Screen readers skip them;
 * the ribbon's sentence has the exact times.
 */
export function HourAxis({ range, onBand = false }: { range: [number, number]; onBand?: boolean }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const [from, to] = range;
  const span = to - from;
  // The labels are placed in pixels, so the row's width is measured (it matches the bar's).
  const [rowWidth, setRowWidth] = useState(0);
  const step = LABEL_STEPS.find((minutes) => (rowWidth * minutes) / span >= LABEL_GAP) ?? 240;
  const labels: number[] = [];
  for (let at = from; at <= to; at += step) labels.push(at);
  // The end of the bar gets its own label when it is a full step past the last one.
  const last = labels[labels.length - 1] ?? from;
  if (last !== to && to - last >= step) labels.push(to);
  return (
    <View
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      testID="ribbon-axis"
      style={styles.axis}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {/* An invisible label gives the row its height; the real ones are placed over it. */}
      <Text
        variant="caption"
        appScale={false}
        maxFontSizeMultiplier={AXIS_SCALE}
        style={styles.gauge}
      >
        {hourText(12, t)}
      </Text>
      {rowWidth > 0
        ? labels.map((at) => {
            const edge = at === from ? 'start' : at === to ? 'end' : null;
            const centre = (rowWidth * (at - from)) / span;
            const left =
              edge === 'start' ? 0 : edge === 'end' ? rowWidth - LABEL : centre - LABEL / 2;
            return (
              <View key={at} style={[styles.label, insetStart(left, language)]}>
                <Text
                  variant="caption"
                  color={onBand ? 'onBandMuted' : 'muted'}
                  numberOfLines={1}
                  appScale={false}
                  maxFontSizeMultiplier={AXIS_SCALE}
                  style={{ textAlign: edge ? textAlignFor(edge, language) : 'center' }}
                >
                  {hourText(at / 60, t)}
                </Text>
              </View>
            );
          })
        : null}
    </View>
  );
}

/** What solid, striped and dotted mean; one legend serves a whole week of ribbons. */
export function RibbonLegend({ kinds, onBand = false }: { kinds: BlockKind[]; onBand?: boolean }) {
  const { t } = useTranslation();
  if (kinds.length === 0) return null;
  return (
    <View style={styles.legend}>
      {kinds.map((kind) => (
        <View key={kind} style={styles.legendItem}>
          <KindSwatch kind={kind} onBand={onBand} />
          <Text variant="caption" color={onBand ? 'onBandMuted' : 'muted'}>
            {t(blockKindKey(kind))}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A small sample of how a kind is drawn, for the legend and the week's list of times. */
export function KindSwatch({
  kind,
  onBand = false,
  width = SWATCH,
}: {
  kind: BlockKind;
  onBand?: boolean;
  width?: number;
}) {
  const { colors } = useTheme();
  const statusColors = onBand ? colors.bandStatus : colors.status;
  return (
    <View style={[styles.swatch, { width }]}>
      <Fill kind={kind} color={statusColors[BLOCK_STATUS[kind]]} width={width} />
    </View>
  );
}

/**
 * How a kind fills its stretch: solid, striped or dotted, inside an outline in its colour.
 * Only as many stripes or dots as fit are drawn, so nothing reaches past the stretch.
 */
function Fill({ kind, color, width }: { kind: BlockKind; color: string; width: number }) {
  if (kind === 'office_hours') return <View style={[styles.fill, { backgroundColor: color }]} />;
  const piece = kind === 'class' ? styles.stripe : styles.dot;
  const room = width - 2 * (OUTLINE + STRIPE) + STRIPE;
  const count = Math.max(0, Math.floor(room / ((kind === 'class' ? STRIPE : DOT) + STRIPE)));
  return (
    <View style={[styles.fill, styles.pieces, { borderColor: color }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[piece, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: { gap: space.xxs },
  plot: { paddingVertical: NOW_OVERHANG },
  track: { height: TRACK, borderRadius: SEGMENT_RADIUS, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0 },
  fill: { flex: 1, borderRadius: SEGMENT_RADIUS },
  pieces: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STRIPE,
    paddingHorizontal: STRIPE,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: OUTLINE,
  },
  stripe: { width: STRIPE, alignSelf: 'stretch' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  now: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1, marginStart: -1 },
  // Hour lines sit under the blocks: they mark the scale without cutting a block in pieces.
  hourLine: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.35 },
  axis: { position: 'relative' },
  gauge: { opacity: 0 },
  label: { position: 'absolute', top: 0, width: LABEL },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { height: 14 },
});
