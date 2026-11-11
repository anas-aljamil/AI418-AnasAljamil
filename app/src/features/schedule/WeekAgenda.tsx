/**
 * The week of a schedule view (owner request 2026-11-11: "more than plain text"), shared by
 * the timetable, booking times and closed message hours.
 * - Phones and tablets: an optional week strip at the top (each day's ranges as coloured bars,
 *   decorative: the list says the same), then one section per day with its count and total
 *   time, "Today" on the current day, and a row per range: start and end, a coloured rail,
 *   the icon, name, label and length, and a chevron (the row opens the editor). The time
 *   between two ranges is marked; consecutive empty days share one line.
 * - Desktop: a week grid, one column per day and the hours down the side, each range a block
 *   of its length (the familiar calendar week). A range past midnight is drawn on both days.
 * Weekly rows fill the week; a weekly row's last date and coming skipped dates are added to its
 * row ("until 31 December, not on 18 October"). Rows on one date (2026-11-11) are listed under
 * "On one date", by date, from today on.
 */
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { Pill } from '@/components/Surfaces';
import { Rail, type RailPattern } from '@/components/Rail';
import { Text } from '@/components/Text';
import { dateText, shortDateText, todayKey } from '@/lib/dates';
import { insetStart } from '@/lib/direction';
import { clockText, daysText, durationText, hourText, timeOfDay } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { useLayout } from '@/lib/layout';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { DAY, dayParts, span, weekMinute, type DatedRange, type WeekRange } from './week';

export interface AgendaItem {
  key: string;
  range: DatedRange;
  title: string;
  /** A short tag after the title, e.g. the course code. */
  label?: string | null;
  /** One more fact, e.g. "Inside your office hours". */
  note?: string | null;
  color: string;
  pattern?: RailPattern;
  icon: ReactNode;
  onPress: () => void;
}

interface WeekAgendaProps {
  days: number[];
  items: AgendaItem[];
  /** Ranges may run past midnight (closed message hours). */
  overnight?: boolean;
  /** Draw the week strip above the list on phones and tablets. */
  overview?: boolean;
}

const HOUR_HEIGHT = space.xxl;
const AXIS_WIDTH = space.xxxl;
const STRIP_HEIGHT = space.xxxl;
const MIN_BLOCK = space.lg;

/** A weekly row's last date and coming skipped dates, after its own note. */
function repeatNote(item: AgendaItem, today: string, t: TFunction): string | null {
  const { ends_on, skipped_dates } = item.range;
  const upcoming = skipped_dates.filter((date) => date >= today);
  const notOn = upcoming.length
    ? t('schedule.not_on', {
        dates:
          upcoming
            .slice(0, 2)
            .map((date) => shortDateText(date, t))
            .join(t('days.separator')) +
          (upcoming.length > 2 ? t('schedule.and_more', { count: upcoming.length - 2 }) : ''),
      })
    : null;
  const shown = [
    item.note,
    ends_on ? t('schedule.until_date', { date: shortDateText(ends_on, t) }) : null,
    notOn,
  ].filter((part): part is string => !!part);
  return shown.length ? spokenList(shown, t) : null;
}

export function WeekAgenda({ days, items, overnight = false, overview = false }: WeekAgendaProps) {
  const { t } = useTranslation();
  const desktop = useLayout() === 'desktop';
  const now = useNow(60_000);
  const today = Math.floor(weekMinute(now) / DAY);
  const todayDate = todayKey(now);
  const weekly = items
    .filter((item) => item.range.day_of_week !== null)
    .map((item) => ({ ...item, note: repeatNote(item, todayDate, t) }));
  const dated = items
    .filter((item) => item.range.on_date !== null && item.range.on_date >= todayDate)
    .sort((a, b) =>
      `${a.range.on_date}${a.range.start_time}`.localeCompare(
        `${b.range.on_date}${b.range.start_time}`,
      ),
    );
  const parts = weekly.flatMap((item) =>
    dayParts(item.range as WeekRange, overnight).map((part) => ({ ...part, item })),
  );
  // The hours shown: whole hours around everything, or a working day when there is nothing.
  const first = parts.length ? Math.floor(Math.min(...parts.map((p) => p.from)) / 60) * 60 : 8 * 60;
  const last = parts.length ? Math.ceil(Math.max(...parts.map((p) => p.to)) / 60) * 60 : 17 * 60;
  const window = { first, last };

  const datedList = dated.length ? <DatedList items={dated} overnight={overnight} /> : null;
  if (desktop)
    return (
      <View style={styles.list}>
        <WeekGrid days={days} parts={parts} today={today} window={window} />
        {datedList}
      </View>
    );
  return (
    <View style={styles.list}>
      {overview && weekly.length > 0 ? (
        <WeekStrip days={days} parts={parts} today={today} window={window} />
      ) : null}
      <DayList days={days} items={weekly} overnight={overnight} today={today} />
      {datedList}
    </View>
  );
}

/** Rows on one date, by date. */
function DatedList({ items, overnight }: { items: AgendaItem[]; overnight: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="title" role="heading">
        {t('schedule.once_heading')}
      </Text>
      {items.map((item) => {
        const { start, length } = span(item.range, overnight);
        return (
          <View key={item.key} style={styles.section}>
            <Text variant="label" weight="semibold">
              {dateText(item.range.on_date!, t)}
            </Text>
            <View
              style={[styles.rows, { borderColor: colors.line, backgroundColor: colors.surface }]}
            >
              <AgendaRow item={item} start={start} length={length} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

type Part = { day: number; from: number; to: number; item: AgendaItem };
type Window = { first: number; last: number };

/** Phones and tablets: a section per day; consecutive empty days share one line. */
function DayList({
  days,
  items,
  overnight,
  today,
}: {
  days: number[];
  items: AgendaItem[];
  overnight: boolean;
  today: number;
}) {
  const { t } = useTranslation();
  const byDay = (day: number) =>
    items
      .filter((item) => item.range.day_of_week === day)
      .sort((a, b) => a.range.start_time.localeCompare(b.range.start_time));

  // Runs of days: a day with ranges on its own, empty neighbours together.
  const runs: { empty: boolean; days: number[] }[] = [];
  for (const day of days) {
    const empty = byDay(day).length === 0;
    const last = runs[runs.length - 1];
    if (empty && last?.empty) last.days.push(day);
    else runs.push({ empty, days: [day] });
  }

  return (
    <>
      {runs.map((run) =>
        run.empty ? (
          <Text key={`empty-${run.days[0]}`} color="muted">
            {t('schedule.empty_days', { days: daysText(run.days, t) })}
          </Text>
        ) : (
          <DaySection
            key={run.days[0]}
            day={run.days[0]!}
            items={byDay(run.days[0]!)}
            overnight={overnight}
            isToday={run.days[0] === today}
          />
        ),
      )}
    </>
  );
}

function DaySection({
  day,
  items,
  overnight,
  isToday,
}: {
  day: number;
  items: AgendaItem[];
  overnight: boolean;
  isToday: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const spans = items.map((item) => span(item.range, overnight));
  const total = spans.reduce((sum, s) => sum + s.length, 0);
  return (
    <View style={styles.section}>
      <View style={styles.dayHead}>
        <Text variant="title" role="heading">
          {t(`weekday.${day}`)}
        </Text>
        {isToday ? <Pill label={t('schedule.today')} tone="primary" /> : null}
        <Text variant="caption" color="muted" style={styles.grow}>
          {t('schedule.day_summary', {
            items: t('schedule.items', { count: items.length }),
            length: durationText(total, t),
          })}
        </Text>
      </View>
      <View style={[styles.rows, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        {items.map((item, index) => {
          const here = spans[index]!;
          const next = spans[index + 1];
          const gap = next && !overnight ? next.start - (here.start + here.length) : 0;
          return (
            <Fragment key={item.key}>
              <AgendaRow item={item} start={here.start} length={here.length} />
              {gap >= 15 ? (
                <View style={[styles.gap, { borderColor: colors.line }]}>
                  <Text variant="caption" color="muted">
                    {t('schedule.gap', { length: durationText(gap, t) })}
                  </Text>
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

function AgendaRow({ item, start, length }: { item: AgendaItem; start: number; length: number }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const Chevron = i18n.language === 'ar' ? ChevronLeft : ChevronRight;
  const wholeDay = length === DAY;
  const startText = clockText(timeOfDay(start), t);
  // A range that ends exactly at midnight says so instead of "12:00 AM".
  const endText =
    start + length === DAY ? t('schedule.midnight') : clockText(timeOfDay(start + length), t);
  const nextDay = start + length > DAY;
  const times = wholeDay
    ? t('schedule.whole_day')
    : nextDay
      ? t('schedule.range_overnight', { start: startText, end: endText })
      : t('schedule.range_line', { start: startText, end: endText });
  const name = item.label ? `${item.title} (${item.label})` : item.title;
  return (
    <Pressable
      role="button"
      accessibilityLabel={spokenList([times, name, durationText(length, t), item.note], t)}
      onPress={item.onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.line : undefined }]}
    >
      <View style={styles.times}>
        <Text weight="semibold">{wholeDay ? t('schedule.whole_day') : startText}</Text>
        {wholeDay ? null : (
          <Text variant="caption" color="muted">
            {nextDay ? t('schedule.end_next_day', { time: endText }) : endText}
          </Text>
        )}
      </View>
      <Rail color={item.color} pattern={item.pattern} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {item.icon}
          <Text weight="medium" style={styles.shrink}>
            {item.title}
          </Text>
          {item.label ? <Pill label={item.label} /> : null}
        </View>
        <Text variant="caption" color="muted">
          {item.note
            ? t('schedule.row_meta', { length: durationText(length, t), note: item.note })
            : durationText(length, t)}
        </Text>
      </View>
      <Chevron color={colors.muted} size={20} strokeWidth={1.75} />
    </Pressable>
  );
}

/** Each day's ranges as bars on a short track, for a glance at the week (decorative). */
function WeekStrip({
  days,
  parts,
  today,
  window,
}: {
  days: number[];
  parts: Part[];
  today: number;
  window: Window;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const total = window.last - window.first;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.strip}>
      {days.map((day) => (
        <View key={day} style={styles.stripDay}>
          <Text
            variant="caption"
            weight={day === today ? 'semibold' : 'regular'}
            color={day === today ? 'primary' : 'muted'}
          >
            {t(`weekday_short.${day}`)}
          </Text>
          <View style={[styles.track, { backgroundColor: colors.line }]}>
            {parts
              .filter((part) => part.day === day)
              .map((part) => (
                <View
                  key={`${part.item.key}-${part.from}`}
                  style={[
                    styles.bar,
                    {
                      backgroundColor: part.item.color,
                      top: ((part.from - window.first) / total) * STRIP_HEIGHT,
                      height: Math.max(2, ((part.to - part.from) / total) * STRIP_HEIGHT),
                    },
                  ]}
                />
              ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Desktop: the week as columns with the hours down the side. */
function WeekGrid({
  days,
  parts,
  today,
  window,
}: {
  days: number[];
  parts: Part[];
  today: number;
  window: Window;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const hours: number[] = [];
  for (let at = window.first; at < window.last; at += 60) hours.push(at);
  const height = hours.length * HOUR_HEIGHT;
  const y = (minute: number) => ((minute - window.first) / 60) * HOUR_HEIGHT;

  return (
    <View style={[styles.grid, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <View style={styles.gridHead}>
        <View style={{ width: AXIS_WIDTH }} />
        {days.map((day) => (
          <View key={day} style={styles.gridHeadDay}>
            <Text variant="label" weight="semibold" role="heading">
              {t(`weekday.${day}`)}
            </Text>
            {day === today ? <Pill label={t('schedule.today')} tone="primary" /> : null}
          </View>
        ))}
      </View>
      <View style={[styles.gridBody, { height }]}>
        <View style={{ width: AXIS_WIDTH }}>
          {hours.map((at) => (
            <Text
              key={at}
              variant="caption"
              color="muted"
              style={[styles.hourLabel, insetStart(space.xs, language), { top: y(at) }]}
            >
              {hourText(Math.floor(at / 60) % 24, t)}
            </Text>
          ))}
        </View>
        {days.map((day) => (
          <View
            key={day}
            style={[
              styles.gridDay,
              { borderColor: colors.line },
              day === today && { backgroundColor: colors.bg },
            ]}
          >
            {hours.map((at) => (
              <View key={at} style={[styles.hourLine, { top: y(at), borderColor: colors.line }]} />
            ))}
            {parts
              .filter((part) => part.day === day)
              .map((part) => {
                const { item } = part;
                const times = t('schedule.range_line', {
                  start: clockText(timeOfDay(part.from), t),
                  end: clockText(timeOfDay(part.to), t),
                });
                const name = item.label ? `${item.title} (${item.label})` : item.title;
                return (
                  <Pressable
                    key={`${item.key}-${part.from}`}
                    role="button"
                    accessibilityLabel={spokenList([times, name, item.note], t)}
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      styles.block,
                      {
                        top: y(part.from),
                        height: Math.max(MIN_BLOCK, y(part.to) - y(part.from)),
                        backgroundColor: pressed ? colors.line : colors.surface,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    <Rail color={item.color} pattern={item.pattern} />
                    <View style={styles.blockBody}>
                      <Text variant="caption" weight="semibold" numberOfLines={1}>
                        {name}
                      </Text>
                      <Text variant="caption" color="muted" numberOfLines={1}>
                        {times}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  section: { gap: space.xs },
  dayHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  grow: { flex: 1 },
  rows: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: space.xxxl,
  },
  times: { width: space.xxxl + space.md, gap: space.xxs },
  body: { flex: 1, gap: space.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  shrink: { flexShrink: 1 },
  gap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    paddingVertical: space.xxs,
    paddingHorizontal: space.sm,
    alignItems: 'center',
  },
  strip: { flexDirection: 'row', gap: space.xs },
  stripDay: { flex: 1, alignItems: 'center', gap: space.xxs },
  track: { width: '100%', height: STRIP_HEIGHT, borderRadius: radii.input, overflow: 'hidden' },
  // Symmetric insets, so physical sides are right in both directions (the web ignores start/end).
  bar: { position: 'absolute', left: 0, right: 0 },
  grid: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.card, overflow: 'hidden' },
  gridHead: { flexDirection: 'row', paddingVertical: space.xs },
  gridHeadDay: { flex: 1, alignItems: 'center', gap: space.xxs },
  gridBody: { flexDirection: 'row' },
  hourLabel: { position: 'absolute', marginTop: -space.xs },
  gridDay: { flex: 1, borderStartWidth: StyleSheet.hairlineWidth },
  hourLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  block: {
    position: 'absolute',
    left: space.xxs,
    right: space.xxs,
    flexDirection: 'row',
    gap: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.input,
    padding: space.xxs,
    overflow: 'hidden',
  },
  blockBody: { flex: 1 },
});
