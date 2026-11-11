/**
 * A date picker drawn as a calendar (owner request 2026-11-11, replacing the booking day strip
 * and added to the schedule editor). Columns are weekdays (Sunday to Thursday for working
 * days, or the whole week), rows are weeks.
 * - Without `paged`, every week from `from` to `to` is shown (the booking calendar: this week
 *   and next).
 * - With `paged`, one month at a time with previous and next buttons (dates further ahead).
 * The chosen day is filled in the primary colour, today has a ring, and days that cannot be
 * chosen are dimmed, stay readable and say so to screen readers.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';

import { addDays, dateText, weekdayOf } from '@/lib/dates';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { IconButton } from './Surfaces';
import { Text } from './Text';

interface CalendarProps {
  /** Names the group for screen readers ("Day", "Date"). */
  label: string;
  value: string | null;
  onChange: (date: string) => void;
  /** First and last dates that may be chosen ("YYYY-MM-DD", inclusive). */
  from: string;
  to: string;
  today: string;
  /** Further limits which dates may be chosen (e.g. days with a booking time). */
  enabled?: (date: string) => boolean;
  /** The weekday columns, 0 = Sunday; working days by default. */
  weekdays?: number[];
  paged?: boolean;
}

const WORKING_DAYS = [0, 1, 2, 3, 4];

const monthOf = (date: string) => date.slice(0, 7);
const firstOfMonth = (month: string) => `${month}-01`;
const nextMonth = (month: string, step: number) => {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const at = new Date(Date.UTC(year, m - 1 + step, 1));
  return at.toISOString().slice(0, 7);
};

export function Calendar({
  label,
  value,
  onChange,
  from,
  to,
  today,
  enabled,
  weekdays = WORKING_DAYS,
  paged = false,
}: CalendarProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [month, setMonth] = useState(monthOf(value && value >= from ? value : from));

  // The weeks shown, each from its Sunday.
  const first = paged ? firstOfMonth(month) : from;
  const last = paged ? addDays(firstOfMonth(nextMonth(month, 1)), -1) : to;
  const weeks: string[] = [];
  for (let sunday = addDays(first, -weekdayOf(first)); sunday <= last; sunday = addDays(sunday, 7))
    weeks.push(sunday);

  const monthName = (m: string) => t(`month.${Number(m.slice(5, 7))}`);
  const heading = paged
    ? t('dates.month_year', { month: monthName(month), year: month.slice(0, 4) })
    : monthOf(from) === monthOf(to)
      ? t('dates.month_year', { month: monthName(from), year: from.slice(0, 4) })
      : t('dates.month_year', {
          month: `${monthName(from)} – ${monthName(to)}`,
          year: to.slice(0, 4),
        });
  const rtl = i18n.language === 'ar';
  const Back = rtl ? ChevronRight : ChevronLeft;
  const Forward = rtl ? ChevronLeft : ChevronRight;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text weight="semibold" style={styles.grow}>
          {heading}
        </Text>
        {paged ? (
          <View style={styles.nav}>
            <IconButton
              label={t('dates.previous_month')}
              icon={<Back color={colors.primary} size={20} strokeWidth={1.75} />}
              onPress={() => setMonth(nextMonth(month, -1))}
              disabled={firstOfMonth(month) <= from}
            />
            <IconButton
              label={t('dates.next_month')}
              icon={<Forward color={colors.primary} size={20} strokeWidth={1.75} />}
              onPress={() => setMonth(nextMonth(month, 1))}
              disabled={last >= to}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.row} aria-hidden importantForAccessibility="no-hide-descendants">
        {weekdays.map((day) => (
          <Text key={day} variant="caption" color="muted" style={styles.cellText}>
            {t(`weekday_short.${day}`)}
          </Text>
        ))}
      </View>
      <View role="radiogroup" accessibilityLabel={label} style={styles.weeks}>
        {weeks.map((sunday) => (
          <View key={sunday} style={styles.row}>
            {weekdays.map((day) => {
              const date = addDays(sunday, day);
              const inView = paged ? monthOf(date) === month : date >= from && date <= to;
              if (!inView) return <View key={date} style={styles.cell} />;
              const allowed = date >= from && date <= to && (enabled ? enabled(date) : true);
              const chosen = value === date;
              const isToday = date === today;
              return (
                <Pressable
                  key={date}
                  role="radio"
                  aria-checked={chosen}
                  aria-disabled={!allowed}
                  disabled={!allowed}
                  accessibilityLabel={spokenList(
                    [
                      dateText(date, t),
                      isToday ? t('dates.today') : null,
                      allowed ? null : t('dates.unavailable'),
                    ],
                    t,
                  )}
                  onPress={() => onChange(date)}
                  style={(state) => {
                    const keyboard = 'focused' in state && (state as { focused?: boolean }).focused;
                    return [
                      styles.cell,
                      styles.day,
                      {
                        backgroundColor: chosen
                          ? colors.primary
                          : state.pressed
                            ? colors.line
                            : 'transparent',
                        borderColor: isToday && !chosen ? colors.primary : 'transparent',
                        opacity: allowed ? 1 : 0.35,
                      },
                      keyboard && {
                        outlineColor: colors.primary,
                        outlineWidth: 2,
                        outlineStyle: 'solid',
                        outlineOffset: 2,
                      },
                    ];
                  }}
                >
                  <Text
                    weight={chosen || isToday ? 'semibold' : 'regular'}
                    color={chosen ? 'onPrimary' : 'text'}
                  >
                    {String(Number(date.slice(8, 10)))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const CELL = space.xxl - space.xxs;

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: space.xxl },
  grow: { flex: 1 },
  nav: { flexDirection: 'row', gap: space.xxs },
  weeks: { gap: space.xxs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xxs },
  cell: { flex: 1, minHeight: CELL, alignItems: 'center', justifyContent: 'center' },
  cellText: { flex: 1, textAlign: 'center' },
  day: { borderRadius: radii.input, borderWidth: 2 },
});
