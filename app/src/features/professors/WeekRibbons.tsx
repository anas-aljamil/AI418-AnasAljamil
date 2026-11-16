/**
 * A professor's working week at a glance, on the profile (owner request 2026-11-16: until now
 * a student saw only today). One day ribbon per day, Sunday to Thursday, all on the same scale
 * so the days line up: office hours solid, classes striped, meetings dotted. Today is marked
 * and carries the "now" line; the hour labels and the legend appear once, under the last day.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProfessorDetail } from '@/api/types';
import { DayRibbon, RibbonLegend, ribbonRange } from '@/components/DayRibbon';
import { Text } from '@/components/Text';
import { BLOCK_KINDS } from '@/lib/blocks';
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
      {week.map((day, index) => {
        const isToday = day.date === today;
        const name = t(`weekday.${day.day_of_week}`);
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
                blocks={day.blocks}
                now={isToday ? now : null}
                range={range}
                dayName={day.blocks.length ? name : `${name}: ${t('prof.week_free')}`}
                legend={false}
                axis={index === week.length - 1}
              />
            </View>
          </View>
        );
      })}
      <RibbonLegend kinds={kinds} />
    </View>
  );
}

const styles = StyleSheet.create({
  week: { gap: space.xs },
  day: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  // Room for the longest weekday name; it wraps under large text instead of squeezing the bar.
  name: { width: 88 },
  ribbon: { flex: 1 },
});
