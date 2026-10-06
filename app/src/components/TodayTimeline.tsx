/**
 * Today's office hours and classes (DESIGN.md 7.4 and 7.8) as an agenda, top to bottom:
 * each block is a row with its times, a door in its status colour, its name, and where it
 * stands now ("Now, until 11:30 AM", or "Finished", dimmed). The time between blocks reads
 * "Not in office", and a "Now" line sits where the current time falls outside the blocks.
 * Colour never carries the meaning alone; each row is read out as one sentence.
 */
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Block } from '@/api/types';
import { clockText, minutesOfDay } from '@/lib/format';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { Door } from './Door';
import { Pill } from './Surfaces';
import { Text } from './Text';

interface TodayTimelineProps {
  blocks: Block[];
  /** Riyadh time now, "HH:MM". */
  now: string;
}

type Stage = 'past' | 'now' | 'later';

export function TodayTimeline({ blocks, now }: TodayTimelineProps) {
  const { t } = useTranslation();
  if (blocks.length === 0) return <Text color="muted">{t('prof.no_blocks')}</Text>;

  const nowMinutes = minutesOfDay(now);
  const sorted = [...blocks].sort(
    (a, b) => minutesOfDay(a.start_time) - minutesOfDay(b.start_time),
  );
  const stageOf = (block: Block): Stage =>
    nowMinutes >= minutesOfDay(block.end_time)
      ? 'past'
      : nowMinutes >= minutesOfDay(block.start_time)
        ? 'now'
        : 'later';
  const first = minutesOfDay(sorted[0]!.start_time);
  const last = minutesOfDay(sorted[sorted.length - 1]!.end_time);

  return (
    <View style={styles.list}>
      {nowMinutes < first ? <NowLine now={now} /> : null}
      {sorted.map((block, index) => {
        const next = sorted[index + 1];
        const gapStart = minutesOfDay(block.end_time);
        const gapEnd = next ? minutesOfDay(next.start_time) : gapStart;
        return (
          <Fragment key={block.block_id}>
            <BlockRow block={block} stage={stageOf(block)} />
            {next && gapEnd > gapStart ? (
              <GapRow
                start={block.end_time}
                end={next.start_time}
                now={nowMinutes >= gapStart && nowMinutes < gapEnd ? now : null}
              />
            ) : null}
          </Fragment>
        );
      })}
      {nowMinutes >= last ? <NowLine now={now} /> : null}
    </View>
  );
}

function BlockRow({ block, stage }: { block: Block; stage: Stage }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const office = block.kind === 'office_hours';
  const name = office ? t('prof.office_hours') : t('prof.class');
  const title = block.label ? `${name} (${block.label})` : name;
  const start = clockText(block.start_time, t);
  const end = clockText(block.end_time, t);
  const state =
    stage === 'now'
      ? t('prof.timeline_now_until', { time: end })
      : stage === 'past'
        ? t('prof.timeline_done')
        : null;
  return (
    <View
      accessible
      accessibilityLabel={spokenList([t('prof.timeline_range', { start, end }), title, state], t)}
      style={[
        styles.row,
        {
          opacity: stage === 'past' ? 0.6 : 1,
          backgroundColor: stage === 'now' ? colors.surface : 'transparent',
          borderColor: stage === 'now' ? colors.primary : 'transparent',
        },
      ]}
    >
      <View style={styles.times}>
        <Text weight="semibold">{start}</Text>
        <Text variant="caption" color="muted">
          {end}
        </Text>
      </View>
      <View
        style={[
          styles.rail,
          { backgroundColor: office ? colors.status.in_office : colors.status.in_class },
        ]}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Door status={office ? 'in_office' : 'in_class'} size={24} />
          <Text weight={stage === 'now' ? 'semibold' : 'medium'} style={styles.grow}>
            {title}
          </Text>
        </View>
        {stage === 'now' ? (
          <View style={styles.start}>
            <Pill label={state!} tone="primary" />
          </View>
        ) : state ? (
          <Text variant="caption" color="muted">
            {state}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function GapRow({ start, end, now }: { start: string; end: string; now: string | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const range = t('prof.timeline_range', { start: clockText(start, t), end: clockText(end, t) });
  return (
    <View
      accessible
      accessibilityLabel={spokenList(
        [range, t('prof.timeline_gap'), now ? t('prof.now', { time: clockText(now, t) }) : null],
        t,
      )}
      style={styles.gap}
    >
      <View style={styles.times} />
      <View style={[styles.gapRail, { borderColor: colors.line }]} />
      <View style={styles.body}>
        <Text variant="caption" color="muted">
          {t('prof.timeline_gap_line', { range })}
        </Text>
        {now ? <NowMark now={now} /> : null}
      </View>
    </View>
  );
}

/** The current time when it falls before the first block or after the last one. */
function NowLine({ now }: { now: string }) {
  return (
    <View style={styles.gap}>
      <View style={styles.times} />
      <View style={styles.body}>
        <NowMark now={now} />
      </View>
    </View>
  );
}

function NowMark({ now }: { now: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.nowMark}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text variant="caption" weight="semibold">
        {t('prof.now', { time: clockText(now, t) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radii.input,
    borderWidth: 1,
  },
  times: { width: 76 },
  rail: { width: 4, borderRadius: 2 },
  gap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.sm,
    paddingVertical: space.xxs,
    paddingHorizontal: space.xs,
  },
  gapRail: { width: 4, borderStartWidth: 2, borderStyle: 'dashed', marginStart: 1 },
  body: { flex: 1, gap: space.xxs, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  start: { alignItems: 'flex-start' },
  nowMark: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
