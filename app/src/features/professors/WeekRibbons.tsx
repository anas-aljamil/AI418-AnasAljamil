/**
 * A professor's working week at a glance, on the profile (owner request 2026-11-16: until now
 * a student saw only today). One day ribbon per day, Sunday to Thursday, all on the same scale
 * so the days line up: office hours solid, classes striped, meetings dotted, hour lines through
 * every bar. The hour labels sit once over the first day; under each bar its times are written
 * out ("10:00–11:30 AM"), so nobody has to read a time off the scale (2026-11-17, owner
 * request: "clearer and more precise"). Today is marked and carries the "now" line.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProfessorDetail } from '@/api/types';
import { DayRibbon, HourAxis, KindSwatch, RibbonLegend, ribbonRange } from '@/components/DayRibbon';
import { Text } from '@/components/Text';
import { BLOCK_KINDS } from '@/lib/blocks';
import { minutesOfDay, rangeText } from '@/lib/format';
import { space } from '@/theme/tokens';

interface WeekRibbonsProps {
  week: ProfessorDetail['week'];
  /** Today's Riyadh date, "YYYY-MM-DD". */
  today: string;
  /** Riyadh time now, "HH:MM". */
  now: string;
}

export function WeekRibbons({ week, today, now }: WeekRibbonsProps) {
  const { t } = useTranslation();
  const every = week.flatMap((day) => day.blocks);
  const range = ribbonRange(every);
  const kinds = BLOCK_KINDS.filter((kind) => every.some((block) => block.kind === kind));
  return (
    <View style={styles.week}>
      <View style={styles.day}>
        <View style={styles.name} />
        <View style={styles.ribbon}>
          <HourAxis range={range} />
        </View>
      </View>
      {week.map((day) => {
        const isToday = day.date === today;
        const name = t(`weekday.${day.day_of_week}`);
        const blocks = [...day.blocks].sort(
          (a, b) => minutesOfDay(a.start_time) - minutesOfDay(b.start_time),
        );
        return (
          <View key={day.date} style={styles.day}>
            <View style={styles.name}>
              <Text variant="label" weight={isToday ? 'semibold' : 'medium'}>
                {name}
              </Text>
              {isToday ? (
                <Text variant="caption" color="primary">
                  {t('prof.week_today')}
                </Text>
              ) : null}
            </View>
            <View style={styles.ribbon}>
              <DayRibbon
                blocks={blocks}
                now={isToday ? now : null}
                range={range}
                dayName={blocks.length ? name : `${name}: ${t('prof.week_free')}`}
                legend={false}
                axis={false}
              />
              {/* The same times the ribbon's own sentence speaks, so hidden from screen readers. */}
              <View
                style={styles.times}
                importantForAccessibility="no-hide-descendants"
                aria-hidden
              >
                {blocks.length === 0 ? (
                  <Text variant="caption" color="muted">
                    {t('prof.week_nothing')}
                  </Text>
                ) : (
                  blocks.map((block) => (
                    <View key={block.block_id} style={styles.time}>
                      <KindSwatch kind={block.kind} />
                      <Text variant="caption">
                        {rangeText(block.start_time, block.end_time, t)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        );
      })}
      <RibbonLegend kinds={kinds} />
    </View>
  );
}

const styles = StyleSheet.create({
  week: { gap: space.sm },
  day: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  // Room for the longest weekday name; it wraps under large text instead of squeezing the bar.
  name: { width: 88 },
  ribbon: { flex: 1, gap: space.xxs },
  times: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs },
  time: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
