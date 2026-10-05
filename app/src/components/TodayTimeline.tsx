/**
 * Today's office hours and classes (DESIGN.md 7.4 and 7.8): a bar from the first to the last
 * block with a marker for the current time, then the same blocks as text, so the colours never
 * carry the meaning alone. Time runs in the reading direction (right to left in Arabic).
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Block } from '@/api/types';
import { insetStart } from '@/lib/direction';
import { clockText, minutesOfDay } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { Text } from './Text';

interface TodayTimelineProps {
  blocks: Block[];
  /** Riyadh time now, "HH:MM". */
  now: string;
}

export function TodayTimeline({ blocks, now }: TodayTimelineProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  if (blocks.length === 0) return <Text color="muted">{t('prof.no_blocks')}</Text>;

  const nowMinutes = minutesOfDay(now);
  const first = Math.min(...blocks.map((b) => minutesOfDay(b.start_time)));
  const last = Math.max(...blocks.map((b) => minutesOfDay(b.end_time)));
  // Whole hours around the blocks; the marker shows only when now falls inside the bar.
  const from = Math.floor(first / 60) * 60;
  const to = Math.ceil(last / 60) * 60;
  const position = (minutes: number) => `${((minutes - from) / (to - from)) * 100}%` as const;
  const showNow = nowMinutes >= from && nowMinutes <= to;

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.bar, { backgroundColor: colors.line }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {blocks.map((block) => (
          <View
            key={block.block_id}
            style={[
              styles.segment,
              {
                ...insetStart(position(minutesOfDay(block.start_time)), language),
                width: `${((minutesOfDay(block.end_time) - minutesOfDay(block.start_time)) / (to - from)) * 100}%`,
                backgroundColor:
                  block.kind === 'office_hours' ? colors.status.in_office : colors.status.in_class,
              },
            ]}
          />
        ))}
        {showNow ? (
          <View
            style={[
              styles.now,
              { ...insetStart(position(nowMinutes), language), backgroundColor: colors.text },
            ]}
          />
        ) : null}
      </View>
      <View
        style={styles.scale}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text variant="caption" color="muted">
          {clockText(`${from / 60}:00`, t)}
        </Text>
        <Text variant="caption" color="muted">
          {clockText(`${to / 60}:00`, t)}
        </Text>
      </View>
      {showNow ? (
        <Text variant="caption" weight="semibold">
          {t('prof.now', { time: clockText(now, t) })}
        </Text>
      ) : null}
      {blocks.map((block) => (
        <Text key={block.block_id}>
          {t('prof.block_line', {
            start: clockText(block.start_time, t),
            end: clockText(block.end_time, t),
            kind: block.kind === 'office_hours' ? t('prof.office_hours') : t('prof.class'),
          })}
          {block.label ? ` (${block.label})` : ''}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  bar: { height: 24, borderRadius: radii.input / 2, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0 },
  now: { position: 'absolute', top: 0, bottom: 0, width: 3 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
});
