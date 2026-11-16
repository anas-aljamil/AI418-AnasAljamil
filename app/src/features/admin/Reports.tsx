/**
 * Reports on the admin overview (owner request 2026-11-16): two aggregates from the database.
 * - Appointments per professor, most first, with how they ended.
 * - The hours of the day appointments start in, as bars, so the busiest hour stands out.
 * Each bar and row also says its numbers in words; nothing is told by length or colour alone.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAdminReports } from '@/api/queries';
import { SkeletonRow } from '@/components/Placeholders';
import { Card } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { hourText } from '@/lib/format';
import { professorName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, type Language } from '@/theme/tokens';

const BAR = 12;

export function Reports() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const reports = useAdminReports();

  if (reports.error && !reports.data) {
    return <SectionError message={t(errorKey(reports.error))} onRetry={() => reports.refetch()} />;
  }
  if (!reports.data) return <SkeletonRow />;
  const { by_professor: professors, by_hour: hours } = reports.data;
  if (professors.length === 0) return <Text color="muted">{t('admin.reports_empty')}</Text>;
  const busiest = Math.max(...hours.map((h) => h.appointments), 1);

  return (
    <View style={styles.reports}>
      <Card>
        <Text variant="label" role="heading">
          {t('admin.reports_by_professor')}
        </Text>
        {professors.map((p) => {
          const name = professorName(p, language, t);
          const detail = spokenList(
            [
              t('admin.reports_done', { count: p.completed }),
              t('admin.reports_upcoming', { count: p.pending + p.approved }),
              p.no_show ? t('admin.reports_no_show', { count: p.no_show }) : null,
              p.declined + p.cancelled
                ? t('admin.reports_dropped', { count: p.declined + p.cancelled })
                : null,
            ],
            t,
          );
          return (
            <View
              key={p.professor_id}
              accessible
              accessibilityLabel={spokenList(
                [name, t('admin.reports_total', { count: p.total }), detail],
                t,
              )}
              style={[styles.row, { borderTopColor: colors.line }]}
            >
              <View style={styles.grow}>
                <Text weight="semibold">{name}</Text>
                <Text variant="caption" color="muted">
                  {detail}
                </Text>
              </View>
              <Text variant="title" weight="bold">
                {p.total}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text variant="label" role="heading">
          {t('admin.reports_by_hour')}
        </Text>
        {hours.map((h) => (
          <View
            key={h.hour}
            accessible
            accessibilityLabel={spokenList(
              [hourText(h.hour, t), t('admin.reports_total', { count: h.appointments })],
              t,
            )}
            style={styles.hour}
          >
            <Text variant="caption" color="muted" style={styles.hourName}>
              {hourText(h.hour, t)}
            </Text>
            <View style={styles.grow}>
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.max(4, (h.appointments / busiest) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text variant="label" weight="semibold">
              {h.appointments}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  reports: { gap: space.sm },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xs,
  },
  hour: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hourName: { width: 64 },
  bar: { height: BAR, borderRadius: radii.pill },
});
