/**
 * The day ribbon (DESIGN.md Section 11): today as one line, from 8 AM to 5 PM or wider when a
 * block starts earlier or ends later. Office hours are a solid bar, classes are striped and
 * meetings dotted, so the kinds differ without colour; a mark shows where "now" is. It is the
 * glance; the agenda (TodayTimeline) under it says the same in words, and screen readers get
 * the ribbon as one sentence.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Block, BlockKind } from '@/api/types';
import { BLOCK_KINDS, BLOCK_STATUS, blockKindKey } from '@/lib/blocks';
import { insetStart } from '@/lib/direction';
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
// Enough pieces for the widest segment; the segment clips what does not fit.
const PIECES = Array.from({ length: 80 }, (_, i) => i);

interface DayRibbonProps {
  blocks: Block[];
  /** Riyadh time now, "HH:MM". */
  now: string;
  /** On the corridor band: band colours. */
  onBand?: boolean;
  /** The names of the kinds shown, under the ribbon. */
  legend?: boolean;
}

export function DayRibbon({ blocks, now, onBand = false, legend = true }: DayRibbonProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const statusColors = onBand ? colors.bandStatus : colors.status;
  const ink = onBand ? colors.onBand : colors.text;
  const muted = onBand ? 'onBandMuted' : 'muted';

  const sorted = [...blocks].sort(
    (a, b) => minutesOfDay(a.start_time) - minutesOfDay(b.start_time),
  );
  // Whole hours around the blocks, never narrower than the working day.
  const from = Math.min(
    DAY_START,
    ...sorted.map((b) => Math.floor(minutesOfDay(b.start_time) / 60) * 60),
  );
  const to = Math.max(DAY_END, ...sorted.map((b) => Math.ceil(minutesOfDay(b.end_time) / 60) * 60));
  const span = to - from;
  const percent = (minutes: number): `${number}%` => `${((minutes - from) / span) * 100}%`;
  const width = (minutes: number): `${number}%` => `${(minutes / span) * 100}%`;

  const nowMinutes = minutesOfDay(now);
  const nowShown = nowMinutes >= from && nowMinutes <= to;
  const hours: number[] = [];
  for (let at = from; at < to; at += 120) hours.push(at);
  const kinds = BLOCK_KINDS.filter((kind) => sorted.some((block) => block.kind === kind));

  const spoken = spokenList(
    [
      t('prof.today'),
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
      sorted.length === 0 ? t('prof.no_blocks') : null,
      t('prof.now', { time: clockText(now, t) }),
    ],
    t,
  );

  return (
    <View style={styles.ribbon}>
      <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={styles.plot}>
        <View style={[styles.track, { backgroundColor: onBand ? colors.bandRaised : colors.line }]}>
          {sorted.map((block) => (
            <View
              key={block.block_id}
              style={[
                styles.segment,
                insetStart(percent(minutesOfDay(block.start_time)), language),
                { width: width(minutesOfDay(block.end_time) - minutesOfDay(block.start_time)) },
              ]}
            >
              <Fill kind={block.kind} color={statusColors[BLOCK_STATUS[block.kind]]} />
            </View>
          ))}
        </View>
        {nowShown ? (
          <View
            style={[
              styles.now,
              insetStart(percent(nowMinutes), language),
              { backgroundColor: ink },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants" aria-hidden>
        {hours.map((at) => (
          <View key={at} style={{ width: width(Math.min(120, to - at)) }}>
            <Text
              variant="caption"
              color={muted}
              numberOfLines={1}
              appScale={false}
              maxFontSizeMultiplier={AXIS_SCALE}
            >
              {hourText(at / 60, t)}
            </Text>
          </View>
        ))}
      </View>
      {legend && kinds.length > 0 ? (
        <View style={styles.legend}>
          {kinds.map((kind) => (
            <View key={kind} style={styles.legendItem}>
              <View style={styles.swatch}>
                <Fill kind={kind} color={statusColors[BLOCK_STATUS[kind]]} />
              </View>
              <Text variant="caption" color={muted}>
                {t(blockKindKey(kind))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** How a kind fills its stretch: solid, striped or dotted, inside an outline in its colour. */
function Fill({ kind, color }: { kind: BlockKind; color: string }) {
  if (kind === 'office_hours') return <View style={[styles.fill, { backgroundColor: color }]} />;
  const piece = kind === 'class' ? styles.stripe : styles.dot;
  return (
    <View style={[styles.fill, styles.pieces, { borderColor: color }]}>
      {PIECES.map((i) => (
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
    overflow: 'hidden',
    borderWidth: 2,
  },
  stripe: { width: STRIPE, alignSelf: 'stretch' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  now: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1, marginStart: -1 },
  axis: { flexDirection: 'row' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 28, height: 14 },
});
